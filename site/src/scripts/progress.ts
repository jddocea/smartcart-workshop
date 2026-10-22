const PREFIX = 'sc-guide:';

const normalize = (path: string) => (path.endsWith('/') ? path : `${path}/`);
const doneKey = (path: string) => `${PREFIX}done:${normalize(path)}`;
const checkKey = (path: string, index: number) => `${PREFIX}${normalize(path)}:${index}`;

function markSidebar(): void {
	for (const link of document.querySelectorAll<HTMLAnchorElement>('nav.sidebar a[href]')) {
		const path = new URL(link.href).pathname;
		link.classList.toggle('sc-complete', localStorage.getItem(doneKey(path)) === '1');
	}
}

function initChecklists(path: string): void {
	const boxes = document.querySelectorAll<HTMLInputElement>('.sl-markdown-content input[type="checkbox"]');
	boxes.forEach((box, index) => {
		const key = checkKey(path, index);
		box.disabled = false;
		box.checked = localStorage.getItem(key) === '1';
		box.addEventListener('change', () => {
			if (box.checked) localStorage.setItem(key, '1');
			else localStorage.removeItem(key);
		});
	});
}

function initDoneButton(path: string): void {
	const button = document.querySelector<HTMLButtonElement>('[data-sc-done]');
	if (!button) return;
	const render = () => {
		const done = localStorage.getItem(doneKey(path)) === '1';
		button.setAttribute('aria-pressed', String(done));
		button.textContent = done ? '✓ Step complete' : 'Mark step complete';
	};
	button.addEventListener('click', () => {
		if (localStorage.getItem(doneKey(path)) === '1') localStorage.removeItem(doneKey(path));
		else localStorage.setItem(doneKey(path), '1');
		render();
		markSidebar();
	});
	render();
}

function initReset(): void {
	document.querySelector('[data-sc-reset]')?.addEventListener('click', () => {
		for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
		location.reload();
	});
}

export function initProgress(): void {
	const path = location.pathname;
	initChecklists(path);
	initDoneButton(path);
	initReset();
	markSidebar();
}
