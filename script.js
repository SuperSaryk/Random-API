const API_URL = 'https://api.jsonbin.io/v3/b/6831fe498960c979a5a0959a';
const TABLE_CONTAINER_ID = 'data-table-container';

// IMPORTANT: Replace 'null' with your actual X-Access-Key if your bin is private.
// If your bin is PUBLIC, 'null' might effectively mean no key, which is fine.
const JSONBIN_ACCESS_KEY = '$2a$10$5yv94w0X.ZrPImzoCbZC5usPV5T2XgdynZR4N1Kd916N8fnEMM5q6'; // Make sure this is your actual key if needed!


// --- State Variables ---
let globalOriginalRecords = []; // Stores the untouched data from the API
let globalDisplayedRecords = []; // Stores the data currently being displayed (can be filtered/modified)
let isEnhancedModeActive = false; // Flag to track if the filter/enhance mode is on
let hasEfOddsBeenAppliedOnce = false; // Flag to ensure +25% is applied only once per activation cycle

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
    container.innerHTML = ''; // Clear previous content

    if (!Array.isArray(recordsToDisplay) || recordsToDisplay.length === 0) {
        container.innerHTML = '<p>No data found or data is empty in the expected array format (data.record.data).</p>';
        // console.warn('Attempted to render with no records or empty array:', recordsToDisplay); // Uncomment for debugging
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

    // Header creation logic
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

    // Body population logic
    recordsToDisplay.forEach(record => {
        const row = document.createElement('tr');
        
        desiredHeaders.forEach(headerText => {
            const td = document.createElement('td');
            if (headerText === newColumnName) {
                const layOdds = parseFloat(record.lay_odds);
                if (!isNaN(layOdds)) {
                    const calculatedValue = calculateLayToBackOdds(layOdds);
                    td.textContent = calculatedValue.toFixed(4); // Format to 4 decimal places
                } else {
                    td.textContent = 'N/A';
                }
            } else {
                td.textContent = record[headerText] !== undefined && record[headerText] !== null ? record[headerText] : '';
                // Ensure ef_odds is displayed with correct precision if it's a float
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
    container.innerHTML = '<p>Loading data...</p>';

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Access-Key': JSONBIN_ACCESS_KEY
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        globalOriginalRecords = data?.record?.data || [];
        
        // Initially, displayed records are the same as original records
        globalDisplayedRecords = JSON.parse(JSON.stringify(globalOriginalRecords)); // Deep copy to prevent modifying original records directly

        renderTable(globalDisplayedRecords);

    } catch (error) {
        console.error('Error fetching or processing data:', error);
        container.innerHTML = `<p>Failed to load data: ${error.message}</p>`;
    }
}

/**
 * Toggles the enhanced mode (filter and adjust ef_odds) or resets to original data.
 */
function handleToggleEfOdds() {
    const adjustButton = document.getElementById('apply-ef-odds-button');

    if (!isEnhancedModeActive) { // Currently in normal mode, switch to enhanced
        let filteredAndModifiedRecords = globalOriginalRecords.filter(record => {
            const efOdds = parseFloat(record.ef_odds);
            return !isNaN(efOdds) && efOdds >= 3.5;
        });

        // Apply +25% only if it hasn't been applied in this cycle yet
        if (!hasEfOddsBeenAppliedOnce) {
            filteredAndModifiedRecords = filteredAndModifiedRecords.map(record => {
                const newRecord = { ...record }; // Create a shallow copy
                newRecord.ef_odds = parseFloat(newRecord.ef_odds) * 1.25;
                return newRecord;
            });
            hasEfOddsBeenAppliedOnce = true; // Mark as applied
        }
        
        globalDisplayedRecords = filteredAndModifiedRecords;
        isEnhancedModeActive = true;
        adjustButton.textContent = 'Reset & Show All';
        adjustButton.style.backgroundColor = '#f44336'; // Change button color to red for "off" state
    } else { // Currently in enhanced mode, switch back to normal
        globalDisplayedRecords = JSON.parse(JSON.stringify(globalOriginalRecords)); // Reset to original data
        isEnhancedModeActive = false;
        hasEfOddsBeenAppliedOnce = false; // Reset flag for next activation
        adjustButton.textContent = 'Activate Filter & Enhance';
        adjustButton.style.backgroundColor = '#4CAF50'; // Change button color back to green for "on" state
    }

    renderTable(globalDisplayedRecords); // Re-render the table with the new state
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initialLoadData(); // Load and display data initially

    const adjustButton = document.getElementById('apply-ef-odds-button');
    if (adjustButton) {
        adjustButton.addEventListener('click', handleToggleEfOdds);
    }
});