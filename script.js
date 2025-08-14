document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const themeSwitcherButtons = document.querySelectorAll('.theme-dot');
    const body = document.body;
    const initialMessage = document.getElementById('initialMessage');

    const modal = document.getElementById('bookModal');
    const closeModal = document.getElementById('closeModal');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalAutor = document.getElementById('modalAutor');
    const modalDescripcion = document.getElementById('modalDescripcion');
    const modalDescarga = document.getElementById('modalDescarga');

    let books = [];

    function loadBooks() {
        fetch('libros.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                books = data;
                if (initialMessage) initialMessage.style.display = 'none';
            })
            .catch(error => {
                console.error('Error fetching or parsing books:', error);
                resultsContainer.innerHTML = `<p class="no-results">Error al cargar los libros: ${error.message}. Por favor, verifica que el archivo 'libros.json' existe y es válido, o inténtalo más tarde.</p>`;
                if (initialMessage) initialMessage.style.display = 'none';
            });
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (initialMessage) initialMessage.style.display = 'none';

        if (searchTerm === '') {
            resultsContainer.innerHTML = '';
            return;
        }

        const filteredBooks = books.filter(book =>
            book.titulo.toLowerCase().includes(searchTerm)
        );

        displayResults(filteredBooks, searchTerm);
    });

    function displayResults(filteredBooks, searchTerm = "") {
        resultsContainer.innerHTML = '';

        if (filteredBooks.length === 0 && searchTerm) {
            const messageP = document.createElement('p');
            messageP.classList.add('no-results');
            messageP.textContent = `No se encontraron libros para "${searchTerm}".`;
            resultsContainer.appendChild(messageP);
        } else if (filteredBooks.length > 0) {
            const fragment = document.createDocumentFragment();
            filteredBooks.forEach(book => {
                const bookElement = document.createElement('article');
                bookElement.classList.add('result-item');

                const titleH3 = document.createElement('h3');
                titleH3.textContent = book.titulo;

                const detailButton = document.createElement('button');
                detailButton.textContent = "Ver detalles";
                detailButton.classList.add('ver-detalles');

                detailButton.addEventListener('click', () => {
                    modalTitulo.textContent = book.titulo;
                    modalAutor.textContent = book.autor || "Desconocido";
                    modalDescripcion.textContent = book.descripcion || "Sin descripción disponible.";
                    modalDescarga.href = `https://drive.google.com/uc?export=download&id=${book.id}`;
                    modal.style.display = 'flex';
                });

                bookElement.appendChild(titleH3);
                bookElement.appendChild(detailButton);
                fragment.appendChild(bookElement);
            });
            resultsContainer.appendChild(fragment);
        }
    }

    // Tema
    themeSwitcherButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedTheme = button.dataset.theme;
            applyTheme(selectedTheme);
            localStorage.setItem('libraryTheme', selectedTheme);
        });
    });

    function applyTheme(themeName) {
        const validThemes = ['claro', 'oscuro', 'daltonico'];
        if (!validThemes.includes(themeName)) {
            console.warn(`Tema inválido: ${themeName}. Usando 'claro'.`);
            themeName = 'claro';
        }

        body.dataset.theme = themeName;

        themeSwitcherButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === themeName);
        });
    }

    function initializeApp() {
        const savedTheme = localStorage.getItem('libraryTheme');
        applyTheme(savedTheme || 'claro');
        loadBooks();
    }

    // Iniciar la aplicación
    initializeApp();

    // Cerrar modal
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
        if (e.target.id === 'bookModal') {
            modal.style.display = 'none';
        }
    });
});

// Efecto de aparición del botón al cargar
window.addEventListener('load', () => {
    const btn = document.getElementById('btnUltraInstinto');
    if (btn) btn.style.opacity = '1';
});

// Botón con texto reactivo
const btnUltra = document.getElementById('btnUltraInstinto');
if (btnUltra) {
    const originalText = btnUltra.textContent;

    btnUltra.addEventListener('mouseenter', () => {
        btnUltra.textContent = '¡Haz clic para despertar el conocimiento!';
    });

    btnUltra.addEventListener('mouseleave', () => {
        btnUltra.textContent = originalText;
    });

    btnUltra.addEventListener('click', () => {
        btnUltra.textContent = 'Cargando sabiduría...';
        setTimeout(() => {
            btnUltra.textContent = originalText;
        }, 2000);
    });
}