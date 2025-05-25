const API_URL = 'https://api.jsonbin.io/v3/b/6831fe498960c979a5a0959a';
const TABLE_CONTAINER_ID = 'data-table-container';

// IMPORTANT: Replace 'YOUR_ACTUAL_JSONBIN_ACCESS_KEY_HERE' with your actual X-Access-Key.
// If your bin is PUBLIC, you can set this to an empty string '' or remove the header from fetch.
// If your bin is PRIVATE, this MUST be your real key.
const JSONBIN_ACCESS_KEY = '$2a$10$5yv94w0X.ZrPImzoCbZC5usPV5T2XgdynZR4N1Kd916N8fnEMM5q6';

/**
 * Calculates lay_to_back odds from lay_odds and commission.
 * Translated from Python: def lay_to_back(lay_odds:float=1000, commission:float=0.03): return 1 + (1-commission)/(lay_odds-1)
 * @param {number} lay_odds The lay odds for the calculation.
 * @param {number} commission The commission rate (e.g., 0.03 for 3%).
 * @returns {number} The calculated lay_to_back odds.
 */
function calculateLayToBackOdds(lay_odds, commission = 0.03) {
    // Handle cases where lay_odds might be 1 or less to prevent division by zero or negative results
    if (lay_odds <= 1) {
        return 0; // Or some other appropriate value indicating invalid input
    }
    return 1 + (1 - commission) / (lay_odds - 1);
}


async function fetchDataAndCreateTable() {
    const container = document.getElementById(TABLE_CONTAINER_ID);

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
        // console.log('Fetched raw API data (for inspection):', data); // Keep this commented out for cleaner console, or uncomment for debugging

        const records = data?.record?.data; // This is the path we confirmed as working

        if (!Array.isArray(records) || records.length === 0) {
            container.innerHTML = '<p>No data found or data is empty in the expected array format (data.record.data).</p>';
            console.warn('API response did not contain an array of records in data.record.data or it was empty:', data);
            return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        const firstRecord = records[0];

        if (firstRecord === null || typeof firstRecord === 'undefined' || typeof firstRecord !== 'object') {
            container.innerHTML = '<p>Data found, but the first record in the array is invalid (null, undefined, or not an object).</p>';
            console.error('The first record in the data array is null, undefined, or not an object:', firstRecord, records);
            return;
        }

        // === MODIFIED HEADER CREATION LOGIC ===
        const originalHeaders = Object.keys(firstRecord);
        const desiredHeaders = [];
        const insertAfterHeader = 'lay_odds'; // The header after which to insert the new column
        const newColumnName = 'lay_to_back_odds'; // The new column name

        originalHeaders.forEach(header => {
            desiredHeaders.push(header);
            if (header === insertAfterHeader) {
                desiredHeaders.push(newColumnName); // Insert the new column name right after 'lay_odds'
            }
        });
        // If 'lay_odds' wasn't found, or if we want to ensure it's always added at the end if not specific
        // (though in this case, it's explicitly placed after 'lay_odds')
        if (!desiredHeaders.includes(newColumnName) && !originalHeaders.includes(newColumnName)) {
             // This condition handles cases where 'lay_odds' might not exist, ensuring 'lay_to_back_odds' is still added somewhere.
             // For simplicity and given your data, we expect 'lay_odds' to always be present.
             // If lay_odds is not found, it would just append to the end.
             // desiredHeaders.push(newColumnName); // Uncomment if you want it always at the end if not explicitly placed.
        }


        const headerRow = document.createElement('tr');
        desiredHeaders.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // === MODIFIED BODY POPULATION LOGIC ===
        records.forEach(record => {
            const row = document.createElement('tr');
            
            desiredHeaders.forEach(headerText => { // Iterate over the desired order of headers
                const td = document.createElement('td');
                if (headerText === newColumnName) {
                    const layOdds = parseFloat(record.lay_odds);
                    if (!isNaN(layOdds)) {
                        const calculatedValue = calculateLayToBackOdds(layOdds); // Use the renamed function
                        td.textContent = calculatedValue.toFixed(4); // Format to 4 decimal places
                    } else {
                        td.textContent = 'N/A';
                    }
                } else {
                    td.textContent = record[headerText] !== undefined && record[headerText] !== null ? record[headerText] : '';
                }
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        container.innerHTML = '';
        container.appendChild(table);

    } catch (error) {
        console.error('Error fetching or processing data:', error);
        container.innerHTML = `<p>Failed to load data: ${error.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', fetchDataAndCreateTable);