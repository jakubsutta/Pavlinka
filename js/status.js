document.addEventListener('DOMContentLoaded', () => {
    // 1. Vytvoření a vložení HTML modálního okna
    const modalHtml = `
        <div id="status-modal-overlay" class="status-modal-overlay">
            <div class="status-modal-window">
                <div class="status-modal-header">
                    <h3>Stav projektu</h3>
                    <button class="status-modal-close" id="status-modal-close" title="Zavřít">&times;</button>
                </div>
                <div class="status-modal-content">
                    <div class="status-option" data-status="update" data-text="Aktualizace">
                        <span class="btn btn-update">Aktualizace</span>
                        <p>Pavlínka se právě aktualizuje a prozatím není zcela hotová.</p>
                    </div>
                    <div class="status-option" data-status="to_update" data-text="K doplnění">
                        <span class="btn btn-to_update">K doplnění</span>
                        <p>Kolem domu je něco nového, co je potřeba do Pavlínky přidat.</p>
                    </div>
                    <div class="status-option" data-status="actual" data-text="Aktuální">
                        <span class="btn btn-actual">Aktuální</span>
                        <p>Vše je aktuální a doplněné.</p>
                    </div>
                    <div class="status-option" data-status="experimental" data-text="Experimentální">
                        <span class="btn btn-experimental">Experimentální</span>
                        <p>V projektu je funkce, která je experimentální a prozatím může zlobit.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const modalEl = document.createElement('div');
    modalEl.innerHTML = modalHtml.trim();
    const modalNode = modalEl.firstElementChild;
    document.body.appendChild(modalNode);

    // 2. Definice proměnných
    const mainBtn = document.getElementById('project-status-btn');
    const modal = document.getElementById('status-modal-overlay');
    const closeBtn = document.getElementById('status-modal-close');
    const options = document.querySelectorAll('.status-option');

    // Bezpečnostní pojistka, pokud by tlačítko chybělo
    if (!mainBtn) return;

    // 3. Aplikace uloženého stavu (nebo výchozí)
    const savedStatus = localStorage.getItem('pavlinka_project_status') || 'update';
    const savedText = localStorage.getItem('pavlinka_project_status_text') || 'Aktualizace';
    
    applyStatus(savedStatus, savedText);

    // 4. Obsluha událostí
    // Otevřít modal
    mainBtn.addEventListener('click', () => {
        modal.classList.add('active');
    });

    // Zavřít modal tlačítkem
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Zavřít modal kliknutím na overlay mimo okno
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Změna stavu po kliknutí na možnost
    options.forEach(option => {
        option.addEventListener('click', () => {
            const newStatus = option.getAttribute('data-status');
            const newText = option.getAttribute('data-text');
            
            // Aplikovat stav vizuálně
            applyStatus(newStatus, newText);
            
            // Uložit stav do localStorage
            localStorage.setItem('pavlinka_project_status', newStatus);
            localStorage.setItem('pavlinka_project_status_text', newText);
            
            // Zavřít okno
            modal.classList.remove('active');
        });
    });

    // Pomocná funkce pro aplikaci stavu na hlavní tlačítko
    function applyStatus(statusName, statusText) {
        // Změna textu
        mainBtn.textContent = statusText;
        
        // Změna třídy
        mainBtn.className = ''; // Smažeme staré třídy
        mainBtn.classList.add('btn');
        mainBtn.classList.add('btn-' + statusName);
    }
});
