const API_URL = 'https://api.jsonbin.io/v3/b/6831fe498960c979a5a0959a';
const TABLE_CONTAINER_ID = 'data-table-container';

// IMPORTANT: Replace 'null' with your actual X-Access-Key if your bin is private.
// If your bin is PUBLIC, 'null' might effectively mean no key, which is fine.
const JSONBIN_ACCESS_KEY = '$2a$10$5yv94w0X.ZrPImzoCbZC5usPV5T2XgdynZR4N1Kd916N8fnEMM5q6'; // Make sure this is your actual key if needed!


// --- State Variables ---
let globalOriginalRecords = [];
let globalDisplayedRecords = [];
let isEnhancedModeActive = false;
let hasEfOddsBeenAppliedOnce = false;

/**
 * Calculates lay_to_back odds from lay_odds and commission.
 * @param {number} lay_odds The lay odds for the calculation.
 * @param {number} commission The commission rate (e.g., 0.03 for 3%).
 * @returns {number} The calculated lay_to_back odds.
 */
function calculateLayToBackOdds(lay_odds, commission = 0.03) {
    if (lay_odds <= 1) {
        return 0;
    }
    return 1 + (1 - commission) / (lay_odds - 1);
}

/**
 * Renders the table based on the provided array of records.
 * @param {Array} recordsToDisplay The array of record objects to display in the table.
 */
function renderTable(recordsToDisplay) {
    const container = document.getElementById(TABLE_CONTAINER_ID);
    if (!container) {
        console.error('Error: Table container element not found with ID:', TABLE_CONTAINER_ID);
        return; // Exit if container isn't found
    }
    container.innerHTML = '';

    if (!Array.isArray(recordsToDisplay) || recordsToDisplay.length === 0) {
        container.innerHTML = '<p>No data found or data is empty in the expected array format (data.record.data).</p>';
        console.warn('Attempted to render with no records or empty array:', recordsToDisplay);
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const firstRecord = recordsToDisplay[0];

    if (firstRecord === null || typeof firstRecord === 'undefined' || typeof firstRecord !== 'object') {
        container.innerHTML = '<p>Data found, but the first record in the array is invalid (null, undefined, or not an object).</p>';
        console.error('The first record in the data array is null, undefined, or not an object:', firstRecord, recordsToDisplay);
        return;
    }

    const originalHeaders = Object.keys(firstRecord);
    const desiredHeaders = [];
    const insertAfterHeader = 'lay_odds';
    const newColumnName = 'lay_to_back_odds';

    originalHeaders.forEach(header => {
        desiredHeaders.push(header);
        if (header === insertAfterHeader) {
            desiredHeaders.push(newColumnName);
        }
    });

    const headerRow = document.createElement('tr');
    desiredHeaders.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    recordsToDisplay.forEach(record => {
        const row = document.createElement('tr');
        
        desiredHeaders.forEach(headerText => {
            const td = document.createElement('td');
            if (headerText === newColumnName) {
                const layOdds = parseFloat(record.lay_odds);
                if (!isNaN(layOdds)) {
                    const calculatedValue = calculateLayToBackOdds(layOdds);
                    td.textContent = calculatedValue.toFixed(4);
                } else {
                    td.textContent = 'N/A';
                }
            } else {
                td.textContent = record[headerText] !== undefined && record[headerText] !== null ? record[headerText] : '';
                if (headerText === 'ef_odds' && !isNaN(parseFloat(td.textContent))) {
                    td.textContent = parseFloat(td.textContent).toFixed(4);
                }
            }
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    container.appendChild(table);
}

/**
 * Fetches data from the API, stores it in globalOriginalRecords,
 * and then renders the initial table using globalDisplayedRecords.
 */
async function initialLoadData() {
    const container = document.getElementById(TABLE_CONTAINER_ID);
    if (container) {
        container.innerHTML = '<p>Loading data...</p>';
    } else {
        console.error('Error: Table container element not found on initial load.');
        return;
    }

    try {
        console.log('Attempting to fetch data from API...'); // New log
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Conditionally add X-Access-Key if it's not 'null' or empty string
                // This can help with some stricter environments
                ...(JSONBIN_ACCESS_KEY && JSONBIN_ACCESS_KEY !== 'null' ? { 'X-Access-Key': JSONBIN_ACCESS_KEY } : {})
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API response not OK:', response.status, errorData); // More detailed error log
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('API data fetched successfully. Raw data:', data); // New log
        globalOriginalRecords = data?.record?.data || [];
        
        globalDisplayedRecords = JSON.parse(JSON.stringify(globalOriginalRecords));

        renderTable(globalDisplayedRecords);
        console.log('Initial table rendering complete.'); // New log

    } catch (error) {
        console.error('Error fetching or processing data:', error);
        if (container) {
            container.innerHTML = `<p>Failed to load data: ${error.message}</p>`;
        }
    }
}

/**
 * Toggles the enhanced mode (filter and adjust ef_odds) or resets to original data.
 */
function handleToggleEfOdds() {
    console.log('Button clicked! Current enhanced mode active:', isEnhancedModeActive); // New log
    const adjustButton = document.getElementById('apply-ef-odds-button');
    if (!adjustButton) {
        console.error('Error: Adjust button element not found.');
        return; // Exit if button isn't found
    }

    if (!isEnhancedModeActive) { // Currently in normal mode, switch to enhanced
        let filteredAndModifiedRecords = globalOriginalRecords.filter(record => {
            const efOdds = parseFloat(record.ef_odds);
            return !isNaN(efOdds) && efOdds >= 3.5;
        });

        if (!hasEfOddsBeenAppliedOnce) {
            console.log('Applying +25% to ef_odds for filtered records...'); // New log
            filteredAndModifiedRecords = filteredAndModifiedRecords.map(record => {
                const newRecord = { ...record };
                newRecord.ef_odds = parseFloat(newRecord.ef_odds) * 1.25;
                return newRecord;
            });
            hasEfOddsBeenAppliedOnce = true;
        } else {
            console.log('+25% already applied in this cycle. Skipping re-application.'); // New log
        }
        
        globalDisplayedRecords = filteredAndModifiedRecords;
        isEnhancedModeActive = true;
        adjustButton.textContent = 'Reset & Show All';
        adjustButton.style.backgroundColor = '#f44336';
        console.log('Switched to enhanced mode. Displaying filtered and modified data.'); // New log
    } else { // Currently in enhanced mode, switch back to normal
        console.log('Resetting to original data...'); // New log
        globalDisplayedRecords = JSON.parse(JSON.stringify(globalOriginalRecords));
        isEnhancedModeActive = false;
        hasEfOddsBeenAppliedOnce = false;
        adjustButton.textContent = 'Activate Filter & Enhance';
        adjustButton.style.backgroundColor = '#4CAF50';
        console.log('Switched to normal mode. Displaying all original data.'); // New log
    }

    renderTable(globalDisplayedRecords);
    console.log('Table re-rendered.'); // New log
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded. Initializing data load and button listener.'); // New log
    initialLoadData();

    const adjustButton = document.getElementById('apply-ef-odds-button');
    if (adjustButton) {
        adjustButton.addEventListener('click', handleToggleEfOdds);
        console.log('Button event listener attached successfully.'); // New log
    } else {
        console.error('Error: Button with ID "apply-ef-odds-button" not found on DOMContentLoaded.'); // New log
    }
});