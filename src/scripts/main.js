'use strict';

const arweave = Arweave.init({host: 'arweave.net', port: 443, protocol: 'https'});

const $search = document.getElementById('search');
const $header = document.getElementById('header');
const $searchTerm = document.getElementById('search_term');
const $container = document.getElementsByClassName('js-container')[0];

let smallHeader = false;

$search.onsubmit = (ev) => {
	ev.preventDefault();

	doSearch($searchTerm.value.trim()).catch(e => {
		console.log(e);

		$container.innerHTML = '<p>There was an error while trying to get the address data. Try again or contact the admin if the error persist.</p>';
	});

	return false;
};

async function doSearch(address = '') {
	if(!address || address.length !== 43)
		return alert('Invalid wallet address.');

	if(!smallHeader) {
		$header.classList.add('animated', 'small-header');
		setTimeout(() => {
			$header.classList.remove('animated');
		}, 3005);
	}

	$container.classList.add('container', 'center-align');
	$container.innerHTML = `<div class="lds-ripple"><div></div><div></div></div>`;

	const links = await getAllLinksByAddress(address);
	if(!links) {
		$container.innerHTML = '<p>This address doesn\'t have any permaweb deployed.</p>';
		return false;
	}

	$container.classList.remove('center-align');
}

async function getAllLinksByAddress(address) {
	const query = {
		op: 'equals',
		expr1: 'from',
		expr2: address
	};
	const res = await arweave.api.post('arql', query);

	let links = [];
	if(res.data && res.data.length) {
		links = await Promise.all(res.data.map(async linkId => {
			let txRow = {};
			const tx = await arweave.transactions.get(linkId);

			tx.get('tags').forEach(tag => {
				let key = tag.get('name', { decode: true, string: true });
				txRow[key.toLowerCase()] = tag.get('value', { decode: true, string: true });
			});

			let data = '';
			if(txRow.hasOwnProperty('content-type')) {
				if(txRow['content-type'] === 'text/html') {
					data = tx.get('data', {decode: true, string: true});
				}
			}

			txRow['id'] = linkId;
			txRow['data'] = data;
			txRow['from'] = await arweave.wallets.ownerToAddress(tx.owner);

			return txRow;
		}));
	}

	if(!links.length) {
		return false;
	}

	$container.innerHTML = await createDomLinks.data(links);

	return true;
}


// Web Workers
const createDomLinks = cw((links) => {
	let html = ``;
	links.forEach(link => {
		if(link['content-type'] === undefined) {
			return true;
		}

		let title = link.data.match(/<title[^>]*>([^<]+)<\/title>/);
		if(title && title.length > 1) {
			title = title[1];
		} else if(link['content-type'] !== 'text/html') {
			title = link['content-type'];
		} else {
			title = "untitledlink";
		}

		let description = link.data.match( /<meta.*?name="description".*?content="(.*?)".*?>|<meta.*?content="(.*?)".*?name="description".*?>/i);
		if(description && description.length > 1) {
			description = description[1];
		} else {
			description = '';
		}

		html += `<a class="permaweb-link" href="https://arweave.net/${link.id}" target="_blank">
	<span class="perma-link">https://arweave.net/${link.id}</span>
	<span class="perma-title">${title}</span>
	<span class="perma-desc">${description}</span>
</a>`;
	});

	return html;
});
