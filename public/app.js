// app.js

// --- CONFIGURATION ---
// !! CRITICAL: Ensure this URL is correct and your ngrok tunnel is running !!
const SERVER_URL = "https://nondiffractive-megan-petechial.ngrok-free.dev"; 

// --- BUDDY LIST DATA & POLLING ---
const BUDDY_LIST = ['Guest', 'Buddy1', 'TestUser']; // The list of friends to check status for
const STATUS_POLL_INTERVAL = 5000; // Poll server every 5 seconds (5000 ms)

// --- GLOBAL REFERENCES (Use 'let' and initialize to null) ---
// These will be populated inside DOMContentLoaded
let awayMessageBox = null;
let awayMessageTextElement = null;
let statusSelect = null;
let statusMessageInput = null;
let textInput = null;
let userInput = null; 
let recipientInput = null;
let buddyListElement = null; // Will hold the #buddy-list element

// =======================================================
// 1. Core Functions
// =======================================================

// Function to handle sending messages (async for server POST)
async function sendMessage() {
    if (!textInput || !userInput || !recipientInput) return;

    const user = userInput.value.trim();
    const text = textInput.value.trim();
    const recipient = recipientInput.value.trim();

    if (text === "" || user === "") {
        console.error("User and message text are required.");
        return; 
    }

    try {
        const response = await fetch(`${SERVER_URL}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, text, recipient })
        });

        if (response.ok) {
            console.log(`[Message Sent]: ${text}`);
            textInput.value = ''; // Clear input
        } else {
            console.error("Failed to send message:", await response.text());
        }
    } catch (error) {
        console.error("Network error sending message:", error);
    }
}

// Function to handle setting status (async for server POST)
async function setStatus() {
    if (!statusSelect || !statusMessageInput || !userInput || !awayMessageBox) {
        console.error("Status elements not fully initialized. Cannot set status.");
        return; 
    }

    const user = userInput.value.trim();
    const newStatus = statusSelect.value;
    const message = statusMessageInput.value.trim();

    if (user === "") {
        alert("Please enter a Screen Name before setting your status.");
        return;
    }

    console.log(`Status set locally to: ${newStatus} (Message: ${message})`);

    // --- CLIENT-SIDE LOGIC: Away Message Toggle & Custom Text ---
    if (newStatus === 'Away') {
        // 1. UPDATE THE MESSAGE CONTENT
        if (awayMessageTextElement) {
            awayMessageTextElement.textContent = message || "Be back soon!";
        }
        
        // 2. SHOW the away message box
        if (awayMessageBox) {
            awayMessageBox.classList.remove('hidden');
        }
    } else {
        // HIDE the away message box
        if (awayMessageBox) {
            awayMessageBox.classList.add('hidden');
        }
    }

    // --- SERVER-SIDE LOGIC: Post to /status endpoint ---
    try {
        const response = await fetch(`${SERVER_URL}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, status: newStatus, message })
        });

        if (response.ok) {
            console.log("Status successfully updated on server (200 OK).");
            // Trigger an immediate poll after a successful status update
            fetchBuddyStatuses();
        } else {
            console.error("Failed to update status on server:", response.status, await response.text());
        }
    } catch (error) {
        console.error("Network error updating status:", error);
    }
}

// Function to add a user to the Buddy List (NOW FULLY IMPLEMENTED)
function addBuddy(buddyName) {
    const name = buddyName.trim();
    const newBuddyInput = document.getElementById('new-buddy-name');

    if (name === "") {
        alert("Please enter a screen name to add.");
        return;
    }

    // Check if the user is already on the list
    if (BUDDY_LIST.includes(name)) {
        console.warn(`Buddy ${name} is already on the list.`);
        if (newBuddyInput) newBuddyInput.value = '';
        return;
    }

    // 1. Add the new name to the list
    BUDDY_LIST.push(name);
    
    // 2. Clear the input field after successful addition
    if (newBuddyInput) {
        newBuddyInput.value = '';
    }

    console.log(`Added buddy: ${name}. Current list:`, BUDDY_LIST);

    // 3. Immediately refresh the displayed list
    fetchBuddyStatuses(); 
}

// Function to process the statuses returned from the server and update the UI
function updateBuddyListUI(statuses) {
    if (!buddyListElement) return;

    buddyListElement.innerHTML = ''; // Clear the current list

    // Convert the statuses array into a quick lookup map
    const statusMap = statuses.reduce((map, item) => {
        map[item.user] = item;
        return map;
    }, {});

    BUDDY_LIST.forEach(user => {
        const userStatus = statusMap[user] || { status: 'Offline', message: '' }; // Default to Offline
        const statusClass = userStatus.status.toLowerCase();
        
        const listItem = document.createElement('div');
        listItem.className = `buddy-item status-${statusClass}`;
        
        // Add a title attribute to show the away message on hover
        listItem.title = userStatus.message ? `${userStatus.status}: ${userStatus.message}` : userStatus.status;

        // Display the user name and status indicator
        listItem.innerHTML = `
            <span class="buddy-name">${user}</span>
            <span class="status-indicator">●</span>
        `;
        buddyListElement.appendChild(listItem);
    });
}

// Function to fetch the statuses of all users in BUDDY_LIST from the server
async function fetchBuddyStatuses() {
    // 1. Convert the array of user names into a comma-separated string for the URL
    const userQuery = BUDDY_LIST.join(',');
    const url = `${SERVER_URL}/status?users=${userQuery}`;

    try {
        const response = await fetch(url);
        
        if (response.ok) {
            const statuses = await response.json();
            
            // 2. Process the statuses and update the UI
            updateBuddyListUI(statuses); 
        } else {
            console.error("Failed to fetch statuses:", response.status);
        }
    } catch (error) {
        console.error("Network error fetching statuses:", error);
    }
}

// Function to start the continuous polling loop
function startStatusPolling() {
    console.log(`Starting status polling every ${STATUS_POLL_INTERVAL / 1000} seconds...`);
    // Run the function immediately, then start the timer
    fetchBuddyStatuses(); 
    setInterval(fetchBuddyStatuses, STATUS_POLL_INTERVAL);
}


// Placeholder functions
function addBuddy(buddyName) {
    // This is the old placeholder, but the function above is the full one. 
    // This section is kept for structural completeness but is overridden by the full function.
}


// =======================================================
// 2. DOM Initialization (Runs after HTML loads)
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded — wiring UI elements');

    // --- A. ELEMENT DEFINITIONS (Populate global 'let' variables) ---
    userInput = document.getElementById('user'); 
    recipientInput = document.getElementById('recipient');
    textInput = document.getElementById('text');
    const sendButton = document.getElementById('send');
    const addBuddyBtn = document.getElementById('add-buddy-btn');
    const newBuddyInput = document.getElementById('new-buddy-name'); // Now present in HTML
    buddyListElement = document.getElementById('buddy-list'); // Initialize the buddy list element


    // --- Away Message Box Check (Dynamic Creation) ---
    awayMessageBox = document.getElementById('away-message-box');
    if (!awayMessageBox) {
        console.warn('Away message box not found in HTML. Creating it dynamically.');
        
        // 1. Create the outer box
        awayMessageBox = document.createElement('div');
        awayMessageBox.id = 'away-message-box';
        awayMessageBox.className = 'hidden'; 
        
        // 2. Create the internal H2 and P tags
        const h2 = document.createElement('h2');
        h2.textContent = 'AWAY MESSAGE';
        
        const p = document.createElement('p');
        p.id = 'away-message-text'; // CRITICAL: Assign the ID here
        p.textContent = 'Be back soon.'; // Initial default text
        
        awayMessageBox.appendChild(h2);
        awayMessageBox.appendChild(p);

        document.body.appendChild(awayMessageBox);
    }
    
    // 3. Assign the awayMessageTextElement global variable 
    awayMessageTextElement = document.getElementById('away-message-text');


    // --- Status Area Check/Creation (Resilience logic) ---
    let statusArea = document.querySelector('.status-area');
    if (!statusArea) {
        console.warn('status-area not found — creating it dynamically');
        statusArea = document.createElement('div');
        statusArea.className = 'status-area';
        
        const select = document.createElement('select');
        select.id = 'status-select';
        select.className = 'input-field status-select';
        select.innerHTML = '<option value="Online">Online</option><option value="Away">Away</option><option value="Invisible">Invisible</option>';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'status-message';
        input.placeholder = 'Status Message (e.g., BRB, coding, etc.)';
        input.className = 'input-field status-message';

        const button = document.createElement('button');
        button.id = 'set-status-btn';
        button.className = 'send-button status-button';
        button.textContent = 'Set Status';

        statusArea.appendChild(select);
        statusArea.appendChild(input);
        statusArea.appendChild(button);

        const inputArea = document.querySelector('.input-area');
        if (inputArea && inputArea.parentNode) {
            inputArea.parentNode.insertBefore(statusArea, inputArea);
        } else {
            const windowContainer = document.querySelector('.window-container') || document.body;
            windowContainer.appendChild(statusArea);
        }
    }

    // --- B. FINAL ELEMENT QUERIES (After dynamic creation) ---
    // Assign to global 'let' variables
    statusSelect = document.getElementById('status-select');
    statusMessageInput = document.getElementById('status-message');
    const setStatusBtn = document.getElementById('set-status-btn');


    // Basic sanity logging
    console.log('Elements:', {
        sendButton: !!sendButton,
        setStatusBtn: !!setStatusBtn,
        addBuddyBtn: !!addBuddyBtn,
        textInput: !!textInput,
        userInput: !!userInput
    });

    // --- C. WIRE LISTENERS SAFELY ---
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (setStatusBtn) setStatusBtn.addEventListener('click', setStatus);
    
    // Also wire the select change event to trigger status update
    if (statusSelect) statusSelect.addEventListener('change', setStatus);

    // Wires the Add Buddy button to the completed function
    if (addBuddyBtn) addBuddyBtn.addEventListener('click', () => {
        // We use newBuddyInput.value here to pass the text to addBuddy
        addBuddy(newBuddyInput.value); 
    });
    
    if (textInput) {
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
    
    // --- D. START APPLICATION LOOP ---
    startStatusPolling();

    console.log('UI wiring complete — status dropdown should be visible now.');
});