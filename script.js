'use strict';

const App = {
    state: {
        books: [],
        filteredBooks: [],
        currentPage: 1,
        booksPerPage: 10,
        themes: ['theme-dark', 'theme-light'],
        currentThemeIndex: 0,
        favorites: JSON.parse(localStorage.getItem('library_favorites') || '[]'),
        showingFavorites: false,
        currentModalBook: null
    },

    DOM: {},

    init() {
        this.cacheDOM();
        this.fetchBooks();
        this.bindEvents();
        this.initParticles();
        this.restoreTheme();
    },

    cacheDOM() {
        const q = id => document.getElementById(id);
        this.DOM = {
            grid:           q('booksGrid'),
            pagination:     q('pagination'),
            authorFilter:   q('authorFilter'),
            genreFilter:    q('genreFilter'),
            searchInput:    q('searchInput'),
            searchClear:    q('searchClear'),
            totalCount:     q('totalBooksCount'),
            showingCount:   q('showingCount'),
            themeToggle:    q('themeToggle'),
            favToggle:      q('favoritesToggle'),
            modal:          q('bookModal'),
            modalImage:     q('modalImage'),
            modalTitle:     q('modalTitle'),
            modalAuthor:    q('modalAuthor'),
            modalDate:      q('modalDate'),
            modalPurpose:   q('modalPurpose'),
            modalGenre:     q('modalGenre'),
            modalBadge:     q('modalBadge'),
            modalFavBtn:    q('modalFavBtn'),
            modalFirstPage: q('modalFirstPage'),
            closeBtn:       q('closeBtn'),
            backdrop:       document.querySelector('.modal-backdrop'),
            themeIcon:      document.querySelector('#themeToggle i')
        };
    },

    async fetchBooks() {
        try {
            const res = await fetch('books.json');
            if (!res.ok) throw new Error('Network error');
            const data = await res.json();

            this.state.books = data;
            this.state.filteredBooks = [...data];

            this.DOM.totalCount.textContent = data.length;
            this.DOM.showingCount.textContent = data.length;

            this.populateFilters(data);
            this.displayBooks();
        } catch (err) {
            this.DOM.grid.innerHTML = `
                <div class="glass-panel" style="grid-column: 1/-1; text-align:center; padding: 40px; border-radius: 16px;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: var(--accent); margin-bottom:12px;"></i>
                    <p style="font-size: 1.1rem;">Could not load books. Please ensure books.json is correct and hosted on a server.</p>
                </div>`;
        }
    },

    populateFilters(data) {
        const addOptions = (selectEl, counts) => {
            Object.keys(counts).sort().forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = `${key} (${counts[key]})`;
                selectEl.appendChild(opt);
            });
        };

        const authorCounts = data.reduce((a, b) => { a[b.author] = (a[b.author] || 0) + 1; return a; }, {});
        addOptions(this.DOM.authorFilter, authorCounts);

        const genreCounts = data.reduce((a, b) => {
            if (b.genre) a[b.genre] = (a[b.genre] || 0) + 1;
            return a;
        }, {});
        addOptions(this.DOM.genreFilter, genreCounts);
    },

    filterBooks() {
        const author = this.DOM.authorFilter.value;
        const genre  = this.DOM.genreFilter.value;
        const search = this.DOM.searchInput.value.toLowerCase().trim();

        this.DOM.searchClear.classList.toggle('visible', search.length > 0);

        let filtered = [...this.state.books];

        if (this.state.showingFavorites) {
            filtered = filtered.filter(b => this.state.favorites.includes(b.title));
        }
        if (author !== 'all') filtered = filtered.filter(b => b.author === author);
        if (genre  !== 'all') filtered = filtered.filter(b => b.genre === genre);
        if (search) filtered = filtered.filter(b =>
            b.title.toLowerCase().includes(search) ||
            b.author.toLowerCase().includes(search)
        );

        this.state.filteredBooks = filtered;
        this.state.currentPage = 1;
        this.DOM.showingCount.textContent = filtered.length;
        this.displayBooks();
    },

    displayBooks() {
        const { filteredBooks, currentPage, booksPerPage, favorites } = this.state;
        this.DOM.grid.innerHTML = '';

        if (filteredBooks.length === 0) {
            this.DOM.grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; margin-top: 40px; font-size: 1.1rem;">No books found matching your criteria.</p>`;
            this.renderPagination(0);
            return;
        }

        const start   = (currentPage - 1) * booksPerPage;
        const visible = filteredBooks.slice(start, start + booksPerPage);
        const fragment = document.createDocumentFragment();

        visible.forEach((book, idx) => {
            const isFav = favorites.includes(book.title);
            const card  = document.createElement('div');
            card.className = 'book-card';
            card.style.animationDelay = `${idx * 50}ms`;

            card.innerHTML = `
                <div class="book-cover-container">
                    <span class="collection-badge">#${book.collectionNumber || (start + idx + 1)}</span>
                    <button class="favorite-btn ${isFav ? 'favorited' : ''}" aria-label="Favorite">
                        <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                    </button>
                    <img src="${this.esc(book.image)}" alt="${this.esc(book.title)} cover" loading="lazy" decoding="async">
                </div>
                <div class="shelf" aria-hidden="true"></div>
                <div class="book-info">
                    <h3>${this.esc(book.title)}</h3>
                    <p>${this.esc(book.author)}</p>
                </div>`;

            card.querySelector('.favorite-btn').addEventListener('click', e => {
                e.stopPropagation();
                this.toggleFavorite(book.title, e.currentTarget);
            });

            card.addEventListener('click', () => this.openModal(book));
            fragment.appendChild(card);
        });

        this.DOM.grid.appendChild(fragment);
        this.renderPagination(filteredBooks.length);
    },

    renderPagination(total) {
        this.DOM.pagination.innerHTML = '';
        const totalPages = Math.ceil(total / this.state.booksPerPage);
        if (totalPages <= 1) return;

        const { currentPage } = this.state;

        const makeBtn = (content, page, disabled = false, active = false) => {
            const btn = document.createElement('button');
            btn.innerHTML = content;
            if (disabled) btn.disabled = true;
            if (active) btn.classList.add('active');
            if (!disabled) btn.addEventListener('click', () => this.changePage(page));
            return btn;
        };

        this.DOM.pagination.appendChild(makeBtn('<i class="fa-solid fa-chevron-left"></i>', currentPage - 1, currentPage === 1));

        let pages = [];
        if (totalPages <= 5) pages = Array.from({ length: totalPages }, (_, i) => i + 1);
        else if (currentPage <= 3) pages = [1, 2, 3, 4, '…', totalPages];
        else if (currentPage >= totalPages - 2) pages = [1, '…', totalPages-3, totalPages-2, totalPages-1, totalPages];
        else pages = [1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages];

        pages.forEach(p => {
            if (p === '…') {
                const span = document.createElement('span');
                span.textContent = '…';
                span.style.padding = '0 10px';
                this.DOM.pagination.appendChild(span);
            } else {
                this.DOM.pagination.appendChild(makeBtn(p, p, false, p === currentPage));
            }
        });

        this.DOM.pagination.appendChild(makeBtn('<i class="fa-solid fa-chevron-right"></i>', currentPage + 1, currentPage === totalPages));
    },

    changePage(page) {
        this.state.currentPage = page;
        this.displayBooks();
        const top = this.DOM.grid.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top, behavior: 'smooth' });
    },

    toggleFavorite(title, btnElement) {
        let { favorites } = this.state;
        const isFav = favorites.includes(title);

        if (isFav) {
            this.state.favorites = favorites.filter(f => f !== title);
            if (btnElement) {
                btnElement.classList.remove('favorited');
                btnElement.innerHTML = '<i class="fa-regular fa-heart"></i>';
            }
        } else {
            this.state.favorites.push(title);
            if (btnElement) {
                btnElement.classList.add('favorited');
                btnElement.innerHTML = '<i class="fa-solid fa-heart"></i>';
            }
        }

        localStorage.setItem('library_favorites', JSON.stringify(this.state.favorites));
        if (this.state.showingFavorites) this.filterBooks();
        if (this.state.currentModalBook?.title === title) this.syncModalFavBtn(title);
    },

    openModal(book) {
        const { DOM } = this;
        this.state.currentModalBook = book;

        DOM.modalImage.src = book.image;
        DOM.modalTitle.textContent = book.title;
        DOM.modalAuthor.innerHTML = `<i class="fa-solid fa-pen-nib"></i> ${this.esc(book.author)}`;
        DOM.modalDate.textContent = book.purchaseDate || '—';
        DOM.modalPurpose.textContent = book.purpose || '—';
        DOM.modalGenre.textContent = book.genre || '—';
        DOM.modalBadge.textContent = `#${book.collectionNumber || ''}`;
        this.syncModalFavBtn(book.title);
        
        DOM.modalFirstPage.src = book.firstPageImage || 'https://images.unsplash.com/photo-1594955325515-388277a060e8?q=80&w=800&auto=format&fit=crop';

        // History API setup for phone back button
        history.pushState({ modalOpen: true }, '', '#book-details');
        
        DOM.modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    closeModal(fromPopState = false) {
        if (!this.DOM.modal.classList.contains('open')) return;

        this.DOM.modal.classList.remove('open');
        document.body.style.overflow = '';
        this.state.currentModalBook = null;

        // If user clicked 'X' or backdrop, go back in history to clean URL
        if (!fromPopState) {
            history.back();
        }
    },

    syncModalFavBtn(title) {
        const isFav = this.state.favorites.includes(title);
        const btn = this.DOM.modalFavBtn;
        btn.classList.toggle('favorited', isFav);
        btn.innerHTML = isFav ? '<i class="fa-solid fa-heart"></i> Remove from Favourites' : '<i class="fa-regular fa-heart"></i> Add to Favourites';
    },

    restoreTheme() {
        const saved = localStorage.getItem('library_theme') || 'theme-dark';
        this.state.currentThemeIndex = this.state.themes.indexOf(saved);
        document.body.classList.remove(...this.state.themes);
        document.body.classList.add(saved);
        this.updateThemeIcon();
    },

    cycleTheme() {
        document.body.classList.remove(this.state.themes[this.state.currentThemeIndex]);
        this.state.currentThemeIndex = (this.state.currentThemeIndex + 1) % this.state.themes.length;
        const next = this.state.themes[this.state.currentThemeIndex];
        document.body.classList.add(next);
        localStorage.setItem('library_theme', next);
        this.updateThemeIcon();
    },

    updateThemeIcon() {
        const isDark = document.body.classList.contains('theme-dark');
        this.DOM.themeIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    },

    initParticles() {
        if (typeof tsParticles === 'undefined') return;
        tsParticles.load('tsparticles', {
            particles: {
                number: { value: 30 },
                color: { value: '#ffffff' },
                opacity: { value: { min: 0.1, max: 0.3 } },
                size: { value: { min: 1, max: 3 } },
                move: { enable: true, speed: 0.2, direction: 'top', random: true }
            }
        });
    },

    bindEvents() {
        const { DOM } = this;
        DOM.authorFilter.addEventListener('change', () => this.filterBooks());
        DOM.genreFilter.addEventListener('change',  () => this.filterBooks());
        DOM.searchInput.addEventListener('input',   () => this.filterBooks());
        DOM.searchClear.addEventListener('click', () => { DOM.searchInput.value = ''; this.filterBooks(); });
        
        DOM.themeToggle.addEventListener('click', () => this.cycleTheme());
        DOM.favToggle.addEventListener('click', () => {
            this.state.showingFavorites = !this.state.showingFavorites;
            DOM.favToggle.classList.toggle('active', this.state.showingFavorites);
            this.filterBooks();
        });
        
        DOM.closeBtn.addEventListener('click', () => this.closeModal());
        DOM.backdrop.addEventListener('click', () => this.closeModal());
        
        document.addEventListener('keydown', e => { 
            if (e.key === 'Escape' && DOM.modal.classList.contains('open')) this.closeModal(); 
        });
        
        // Handle Mobile Back Button (History API)
        window.addEventListener('popstate', (e) => {
            if (DOM.modal.classList.contains('open')) {
                this.closeModal(true); // true means it came from back button
            }
        });

        DOM.modalFavBtn.addEventListener('click', () => { 
            if (this.state.currentModalBook) this.toggleFavorite(this.state.currentModalBook.title, DOM.modalFavBtn); 
        });
    },

    esc(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());