
/* =====================================================
   SMS - SMART MEMBERSHIP SYSTEM
   Main Admin Dashboard JavaScript
===================================================== */


/* =====================================================
   1. CONFIGURATION
===================================================== */

const STORAGE_KEYS = {
    customers: "sms_customers",
    settings: "sms_settings",
    transactions: "sms_transactions",
    purchases: "sms_purchases",
    redemptionRequests: "sms_redemption_requests"
};

const DEFAULT_SETTINGS = {
    shopName: "My Shop",
    minimumPurchase: 100,
    requiredStamps: 5,
    rewardName: "Free Screen Guard",
    rewardDescription: "Collect 5 stamps and get a free screen guard!"
};

const SMS_API_URL = "https://script.google.com/macros/s/AKfycbzDuEEL4A3z61OMktFnnOQG59-OY8jaP7TPMaOEG0-dhf13d9dnkWmjvFIP-SCJyudT/exec";
const SMS_ADMIN_PIN_KEY = "sms_admin_pin_session";
let smsAdminPin = sessionStorage.getItem(SMS_ADMIN_PIN_KEY) || "";
let smsBackendReady = false;

async function smsApiGet(action, params = {}) {
    const url = new URL(SMS_API_URL);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Backend request failed (${response.status}).`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Backend request failed.");
    return data;
}

async function smsApiPost(action, payload = {}) {
    const response = await fetch(SMS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, adminPin: smsAdminPin, ...payload })
    });
    if (!response.ok) throw new Error(`Backend request failed (${response.status}).`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Backend request failed.");
    return data;
}

function requestAdminPin() {
    const entered = window.prompt("Enter your shop admin PIN:");
    if (!entered) throw new Error("Admin PIN is required to access the dashboard.");
    smsAdminPin = entered.trim();
    sessionStorage.setItem(SMS_ADMIN_PIN_KEY, smsAdminPin);
}

async function withAdminPinRetry(task) {
    try { return await task(); }
    catch (error) {
        if (/Unauthorized admin request|Admin PIN is not configured/i.test(error.message)) {
            sessionStorage.removeItem(SMS_ADMIN_PIN_KEY);
            smsAdminPin = "";
            requestAdminPin();
            return await task();
        }
        throw error;
    }
}



/* =====================================================
   2. GLOBAL VARIABLES
===================================================== */

let customers = [];
let transactions = [];
let purchases = [];
let redemptionRequests = [];
let settings = {};

let html5QrCode = null;
let currentQrCustomer = null;


/* =====================================================
   3. STORAGE FUNCTIONS
===================================================== */

async function loadData() {
    if (!smsAdminPin) requestAdminPin();
    await refreshAdminData();
}

async function refreshAdminData() {
    const data = await withAdminPinRetry(() => smsApiGet("getAdminData", { adminPin: smsAdminPin }));
    customers = data.customers || [];
    transactions = data.transactions || [];
    purchases = data.purchases || [];
    redemptionRequests = data.redemptionRequests || [];
    settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    smsBackendReady = true;
    return data;
}

// Google Sheets is the source of truth; legacy save helpers no longer write localStorage.
function saveCustomers() {}
function saveSettings() {}
function saveTransactions() {}
function savePurchases() {}
function saveRedemptionRequests() {}
function saveAllData() {}


/* =====================================================
   4. DOM ELEMENT HELPERS
===================================================== */

function getElement(id) {

    return document.getElementById(id);

}


function setText(id, value) {

    const element = getElement(id);

    if (element) {
        element.textContent = value;
    }

}


function escapeHTML(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]
    );

}


function formatCurrency(amount) {

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);

}


function formatDate(date) {

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

}


function generateID(prefix) {

    return prefix + Date.now().toString(36).toUpperCase() +
        Math.random().toString(36).substring(2, 6).toUpperCase();

}


function generateToken() {

    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }

    return generateID("TOKEN");

}


/* =====================================================
   5. NOTIFICATION SYSTEM
===================================================== */

let toastTimeout;

function showToast(message, type = "success") {

    const toast = getElement("toast");
    const toastMessage = getElement("toast-message");

    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;

    toast.classList.remove(
        "show",
        "error",
        "warning"
    );

    if (type !== "success") {
        toast.classList.add(type);
    }

    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}


/* =====================================================
   6. SIDEBAR NAVIGATION
===================================================== */

function initializeNavigation() {

    const navigationButtons = document.querySelectorAll(
        ".nav-item, [data-page]"
    );

    navigationButtons.forEach(button => {

        button.addEventListener("click", () => {

            const pageName = button.dataset.page;

            if (!pageName) return;

            navigateToPage(pageName);

        });

    });


    const menuToggle = getElement("menu-toggle");
    const sidebar = getElement("sidebar");

    if (menuToggle && sidebar) {

        menuToggle.addEventListener("click", () => {

            sidebar.classList.toggle("sidebar-open");

        });

    }

}


function navigateToPage(pageName) {

    const pages = document.querySelectorAll(".page");

    pages.forEach(page => {

        page.classList.remove("active");

    });


    const selectedPage = getElement(pageName);

    if (!selectedPage) return;

    selectedPage.classList.add("active");


    document.querySelectorAll(".nav-item").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );

    });


    setText(
        "breadcrumb-page",
        pageName.charAt(0).toUpperCase() + pageName.slice(1)
    );


    const sidebar = getElement("sidebar");

    if (sidebar) {
        sidebar.classList.remove("sidebar-open");
    }


    refreshPageData(pageName);

}


function refreshPageData(pageName) {

    switch (pageName) {

        case "dashboard":
            updateDashboard();
            break;

        case "customers":
            renderCustomers();
            break;

        case "purchases":
            renderPurchases();
            updatePurchaseRules();
            break;

        case "rewards":
            renderRewards();
            break;

        case "transactions":
            renderTransactions();
            break;

        case "settings":
            loadSettingsForm();
            break;

    }

}


/* =====================================================
   7. MODAL MANAGEMENT
===================================================== */

function openModal(id) {

    const modal = getElement(id);

    if (modal) {
        modal.classList.add("active");
    }

}


function closeModal(id) {

    const modal = getElement(id);

    if (modal) {
        modal.classList.remove("active");
    }

}


function initializeModals() {

    getElement("add-customer-btn")?.addEventListener(
        "click",
        openCustomerModal
    );

    getElement("customers-add-btn")?.addEventListener(
        "click",
        openCustomerModal
    );

    getElement("close-customer-modal")?.addEventListener(
        "click",
        () => closeModal("customer-modal")
    );

    getElement("cancel-customer")?.addEventListener(
        "click",
        () => closeModal("customer-modal")
    );

    getElement("close-scanner-modal")?.addEventListener(
        "click",
        stopScanner
    );

    getElement("close-qr-modal")?.addEventListener(
        "click",
        () => closeModal("qr-modal")
    );


    document.querySelectorAll(".modal-overlay").forEach(modal => {

        modal.addEventListener("click", event => {

            if (event.target === modal) {

                if (modal.id === "scanner-modal") {
                    stopScanner();
                } else {
                    closeModal(modal.id);
                }

            }

        });

    });

}


function openCustomerModal() {

    getElement("customer-form")?.reset();

    openModal("customer-modal");

}


/* =====================================================
   8. CUSTOMER REGISTRATION
===================================================== */

function initializeCustomerForm() {

    const form = getElement("customer-form");

    if (!form) return;

    form.addEventListener("submit", async event => {

        event.preventDefault();

        const name = getElement("customer-full-name").value.trim();

        const phone = getElement("customer-phone").value.trim();

        if (!name || !phone) {

            showToast("Please enter customer details.", "error");

            return;

        }


        if (!/^[0-9]{10}$/.test(phone)) {

            showToast(
                "Enter a valid 10-digit phone number.",
                "error"
            );

            return;

        }


        try {
            const result = await withAdminPinRetry(() => smsApiPost("registerCustomer", { name, phone }));
            await refreshAdminData();
            closeModal("customer-modal");
            showToast("Customer registered successfully!");
            updateDashboard();
            renderCustomers();
            showCustomerQR(result.customer);
        } catch (error) {
            showToast(error.message || "Unable to register customer.", "error");
        }

    });

}


/* =====================================================
   9. CUSTOMER QR CODE GENERATION
===================================================== */

function getCustomerPageURL(customer) {

    const customerPage = new URL(
        "customer.html",
        window.location.href
    );

    customerPage.searchParams.set(
        "token",
        customer.token
    );

    return customerPage.href;

}


function showCustomerQR(customer) {

    currentQrCustomer = customer;

    const qrContainer = getElement("customer-qr-code");

    if (!qrContainer) return;

    qrContainer.innerHTML = "";

    setText("qr-customer-name", customer.name);

    setText("qr-membership-id", customer.membershipId);


    const customerURL = getCustomerPageURL(customer);

    if (typeof QRCode === "undefined") {

        showToast("QR code library could not load.", "error");

        return;

    }


    new QRCode(qrContainer, {

        text: customerURL,

        width: 220,

        height: 220,

        colorDark: "#152238",

        colorLight: "#ffffff",

        correctLevel: QRCode.CorrectLevel.H

    });


    openModal("qr-modal");

}


function initializeQRDownload() {

    const button = getElement("download-qr-btn");

    if (!button) return;

    button.addEventListener("click", () => {

        const qrCanvas = document.querySelector(
            "#customer-qr-code canvas"
        );

        const qrImage = document.querySelector(
            "#customer-qr-code img"
        );

        const imageURL = qrCanvas
            ? qrCanvas.toDataURL("image/png")
            : qrImage?.src;

        if (!imageURL) {

            showToast("QR code is not ready.", "error");

            return;

        }


        const link = document.createElement("a");

        link.href = imageURL;

        link.download =
            `${currentQrCustomer?.membershipId || "SMS"}-QR.png`;

        link.click();

    });

}


/* =====================================================
   10. CUSTOMER TABLE
===================================================== */

function renderCustomers(searchTerm = "") {

    const table = getElement("customers-table");

    if (!table) return;

    const search = searchTerm.toLowerCase();

    const filteredCustomers = customers.filter(customer => {

        return (
            customer.name.toLowerCase().includes(search) ||
            customer.phone.includes(search) ||
            customer.membershipId.toLowerCase().includes(search)
        );

    });


    if (filteredCustomers.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="6">No customers found.</td>
            </tr>
        `;

        return;

    }


    table.innerHTML = filteredCustomers.map(customer => {

        return `
            <tr>

                <td>
                    <div class="customer-name">
                        ${escapeHTML(customer.name)}
                    </div>
                </td>

                <td>${escapeHTML(customer.phone)}</td>

                <td>${escapeHTML(customer.membershipId)}</td>

                <td>
                    ${Number(customer.stamps) || 0}
                    / ${settings.requiredStamps}
                </td>

                <td>
                    <span class="status-badge ${
                        customer.status === "active"
                            ? "active"
                            : "blocked"
                    }">
                        ${escapeHTML(customer.status)}
                    </span>
                </td>

                <td>
                    <div class="action-buttons">

                        <button
                            type="button"
                            class="action-btn"
                            data-action="show-qr"
                            data-id="${escapeHTML(customer.id)}"
                            title="Show QR"
                        >
                            <i class="fa-solid fa-qrcode"></i>
                        </button>

                        <button
                            type="button"
                            class="action-btn"
                            data-action="toggle-status"
                            data-id="${escapeHTML(customer.id)}"
                            title="Block or activate customer"
                        >
                            <i class="fa-solid fa-ban"></i>
                        </button>

                    </div>
                </td>

            </tr>
        `;

    }).join("");

}


function initializeCustomerSearch() {

    const searchInput = getElement("customer-search");

    if (!searchInput) return;

    searchInput.addEventListener("input", () => {

        renderCustomers(searchInput.value);

    });

}


function initializeCustomerActions() {
    getElement("customers-table")?.addEventListener("click", async event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const customer = customers.find(item => item.id === button.dataset.id);
        if (!customer) return;
        if (button.dataset.action === "show-qr") {
            if (customer.status !== "active") { showToast("This membership card is blocked.", "error"); return; }
            showCustomerQR(customer);
        }
        if (button.dataset.action === "toggle-status") {
            try {
                await withAdminPinRetry(() => smsApiPost("toggleCustomerStatus", { customerId: customer.id }));
                await refreshAdminData();
                renderCustomers(); updateDashboard(); renderTransactions();
                const updated = customers.find(item => item.id === customer.id);
                showToast(`Customer membership ${updated?.status || "updated"}.`);
            } catch (error) { showToast(error.message || "Unable to update membership.", "error"); }
        }
    });
}


/* =====================================================
   11. DASHBOARD STATISTICS
===================================================== */

function updateDashboard() {

    const activeCustomers = customers.filter(
        customer => customer.status === "active"
    );

    const totalStamps = customers.reduce(
        (total, customer) => total + (Number(customer.stamps) || 0),
        0
    );

    const totalRewards = transactions.filter(
        transaction => transaction.type === "Reward Redeemed"
    ).length;


    setText("total-customers", activeCustomers.length);

    setText("total-purchases", purchases.length);

    setText("total-stamps", totalStamps);

    setText("total-rewards", totalRewards);


    setText(
        "dashboard-reward-name",
        settings.rewardName
    );

    setText(
        "dashboard-required-stamps",
        settings.requiredStamps
    );


    renderRecentCustomers();

}


function renderRecentCustomers() {

    const table = getElement("recent-customers-table");

    if (!table) return;

    const recentCustomers = [...customers]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);


    if (recentCustomers.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="4">No customers registered yet.</td>
            </tr>
        `;

        return;

    }


    table.innerHTML = recentCustomers.map(customer => {

        return `
            <tr>

                <td>${escapeHTML(customer.name)}</td>

                <td>${escapeHTML(customer.membershipId)}</td>

                <td>
                    ${Number(customer.stamps) || 0}
                    / ${settings.requiredStamps}
                </td>

                <td>
                    <span class="status-badge ${escapeHTML(customer.status)}">
                        ${escapeHTML(customer.status)}
                    </span>
                </td>

            </tr>
        `;

    }).join("");

}


/* =====================================================
   12. PURCHASE FORM
===================================================== */

function initializePurchaseForm() {

    const form = getElement("purchase-form");

    if (!form) return;

    form.addEventListener("submit", async event => {

        event.preventDefault();

        const membershipId = getElement(
            "purchase-customer"
        ).value.trim();

        const product = getElement(
            "purchase-product"
        ).value.trim();

        const amount = Number(
            getElement("purchase-amount").value
        );


        const customer = customers.find(
            item => item.membershipId.toLowerCase() ===
                membershipId.toLowerCase()
        );


        if (!customer) {

            showToast("Customer membership not found.", "error");

            return;

        }


        if (customer.status !== "active") {

            showToast("This customer card is blocked.", "error");

            return;

        }


        if (!product || amount <= 0 || !Number.isFinite(amount)) {

            showToast("Enter valid purchase details.", "error");

            return;

        }


        if (amount < Number(settings.minimumPurchase)) {

            showToast(
                `Minimum qualifying purchase is ${formatCurrency(settings.minimumPurchase)}.`,
                "warning"
            );

            return;

        }


        if (
            Number(customer.stamps) >= Number(settings.requiredStamps)
        ) {

            showToast(
                "This customer has an unredeemed reward. Redeem it first.",
                "warning"
            );

            return;

        }


        try {
            await recordPurchase(customer, product, amount);
            form.reset();
        } catch (error) {
            showToast(error.message || "Unable to record purchase.", "error");
        }

    });

}


/* =====================================================
   13. RECORD PURCHASE AND AWARD STAMP
===================================================== */

async function recordPurchase(customer, product, amount) {
    const result = await withAdminPinRetry(() => smsApiPost("recordPurchase", {
        membershipId: customer.membershipId, product, amount
    }));
    await refreshAdminData();
    showToast(Number(result.customer.stamps) >= Number(settings.requiredStamps)
        ? `${result.customer.name} unlocked a reward!`
        : "Purchase recorded and stamp awarded!");
    updateDashboard(); renderCustomers(); renderPurchases(); renderRewards(); renderTransactions();
}


/* =====================================================
   14. PURCHASE TABLE
===================================================== */

function renderPurchases() {

    const table = getElement("purchases-table");

    if (!table) return;

    const recentPurchases = [...purchases]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));


    if (recentPurchases.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="5">No purchases recorded yet.</td>
            </tr>
        `;

        return;

    }


    table.innerHTML = recentPurchases.map(purchase => {

        return `
            <tr>

                <td>${escapeHTML(purchase.customerName)}</td>

                <td>${escapeHTML(purchase.product)}</td>

                <td>${formatCurrency(purchase.amount)}</td>

                <td>${formatDate(purchase.createdAt)}</td>

                <td>
                    <span class="status-badge active">
                        +1 Stamp
                    </span>
                </td>

            </tr>
        `;

    }).join("");

}


function updatePurchaseRules() {

    setText(
        "purchase-minimum",
        formatCurrency(settings.minimumPurchase)
    );

    setText(
        "purchase-required-stamps",
        settings.requiredStamps
    );

    setText(
        "purchase-reward-name",
        settings.rewardName
    );

}


/* =====================================================
   15. QR SCANNER
===================================================== */

function initializeScannerButtons() {

    getElement("scan-qr-btn")?.addEventListener(
        "click",
        startScanner
    );

    getElement("purchase-scan-btn")?.addEventListener(
        "click",
        startScanner
    );

}


async function startScanner() {

    if (typeof Html5Qrcode === "undefined") {

        showToast("QR scanner library could not load.", "error");

        return;

    }


    openModal("scanner-modal");

    setText("scanner-result", "");


    try {

        html5QrCode = new Html5Qrcode("qr-reader");

        await html5QrCode.start(

            { facingMode: "environment" },

            {
                fps: 10,
                qrbox: {
                    width: 250,
                    height: 250
                }
            },

            onQRCodeScanned,

            () => {}

        );

    } catch (error) {

        console.error("Scanner error:", error);

        showToast(
            "Unable to access camera. Check camera permissions.",
            "error"
        );

        closeModal("scanner-modal");

    }

}


async function stopScanner() {

    if (html5QrCode) {

        try {

            if (html5QrCode.isScanning) {
                await html5QrCode.stop();
            }

            html5QrCode.clear();

        } catch (error) {

            console.error("Scanner stop error:", error);

        }

        html5QrCode = null;

    }

    closeModal("scanner-modal");

}


async function onQRCodeScanned(decodedText) {

    await stopScanner();

    let token;

    try {

        const scannedURL = new URL(decodedText);

        token = scannedURL.searchParams.get("token");

    } catch {

        token = decodedText.trim();

    }


    const customer = customers.find(
        item => item.token === token ||
            item.membershipId === token
    );


    if (!customer) {

        showToast("Invalid or unrecognized QR code.", "error");

        return;

    }


    if (customer.status !== "active") {

        showToast("This customer membership is blocked.", "error");

        return;

    }


    getElement("purchase-customer").value =
        customer.membershipId;

    navigateToPage("purchases");

    showToast(
        `Customer found: ${customer.name}`
    );

}


/* =====================================================
   16. REWARD MANAGEMENT
===================================================== */

function getCustomerRewardStatus(customer) {

    const stamps = Number(customer.stamps) || 0;

    if (stamps >= settings.requiredStamps) {
        return "Unlocked";
    }

    return "Locked";

}


function renderRewards() {

    const table = getElement("rewards-table");

    if (!table) return;

    const unlockedCustomers = customers.filter(customer =>
        customer.status === "active" &&
        getCustomerRewardStatus(customer) === "Unlocked" &&
        !customer.rewardRedeemed
    );

    const redeemedCount = transactions.filter(
        transaction => transaction.type === "Reward Redeemed"
    ).length;

    const pendingRequests = redemptionRequests.filter(
        request => request.status === "pending"
    );

    setText("unlocked-rewards", unlockedCustomers.length);
    setText("redeemed-rewards", redeemedCount);

    if (customers.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="5">No customers registered yet.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = customers.map(customer => {

        const unlocked =
            getCustomerRewardStatus(customer) === "Unlocked" &&
            !customer.rewardRedeemed;

        const blocked = customer.status !== "active";

        const request = redemptionRequests
            .filter(item => item.customerToken === customer.token)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

        let status = blocked
            ? "Blocked"
            : customer.rewardRedeemed
                ? "Redeemed"
                : request?.status === "pending"
                    ? "Request Pending"
                    : request?.status === "rejected"
                        ? "Request Rejected"
                        : unlocked
                            ? "Unlocked"
                            : "Locked";

        let actions = "-";

        if (!blocked && request?.status === "pending") {
            actions = `
                <div class="reward-action-group">
                    <button type="button" class="primary-btn small-btn"
                        data-action="approve-redemption"
                        data-request-id="${escapeHTML(request.id)}">
                        Approve
                    </button>
                    <button type="button" class="secondary-btn small-btn"
                        data-action="reject-redemption"
                        data-request-id="${escapeHTML(request.id)}">
                        Reject
                    </button>
                </div>
            `;
        } else if (unlocked && !blocked) {
            actions = `<span class="info-note">Waiting for customer request</span>`;
        }

        return `
            <tr>
                <td>${escapeHTML(customer.name)}</td>
                <td>${escapeHTML(customer.membershipId)}</td>
                <td>${escapeHTML(settings.rewardName)}</td>
                <td>
                    <span class="status-badge ${
                        status === "Unlocked" || status === "Request Pending"
                            ? "active" : "inactive"
                    }">${escapeHTML(status)}</span>
                </td>
                <td>${actions}</td>
            </tr>
        `;

    }).join("");

    // Keep the pending count available for future dashboard use.
    const pendingCountElement = getElement("pending-redemptions");
    if (pendingCountElement) {
        pendingCountElement.textContent = pendingRequests.length;
    }
}


function initializeRewardActions() {
    const table = getElement("rewards-table");
    if (!table) return;
    table.addEventListener("click", async event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        const request = redemptionRequests.find(item => item.id === button.dataset.requestId);
        if (!request || request.status !== "pending") return;
        const customer = customers.find(item => item.token === request.customerToken);
        if (!customer || customer.status !== "active") { showToast("The customer membership could not be verified.", "error"); return; }
        if (action !== "approve-redemption" && action !== "reject-redemption") return;
        const confirmed = window.confirm(action === "approve-redemption"
            ? `Confirm that ${request.rewardName || settings.rewardName} has been given to ${customer.name}?`
            : `Reject the redemption request from ${customer.name}?`);
        if (!confirmed) return;
        try {
            await withAdminPinRetry(() => smsApiPost(action === "approve-redemption" ? "approveRedemption" : "rejectRedemption", { requestId: request.id }));
            await refreshAdminData();
            updateDashboard(); renderRewards(); renderCustomers(); renderTransactions();
            showToast(action === "approve-redemption" ? "Redemption approved successfully!" : "Redemption request rejected.", action === "approve-redemption" ? "success" : "error");
        } catch (error) { showToast(error.message || "Unable to update redemption.", "error"); }
    });
}


/* =====================================================
   17. TRANSACTION MANAGEMENT
===================================================== */

function addTransaction(customerId, type, details) {

    const customer = customers.find(
        item => item.id === customerId
    );

    const transaction = {

        id: generateID("TXN"),

        customerId: customerId,

        customerName: customer
            ? customer.name
            : "Unknown Customer",

        type: type,

        details: details,

        createdAt: new Date().toISOString()

    };


    transactions.push(transaction);

    saveTransactions();

}


function renderTransactions() {

    const table = getElement("transactions-table");

    if (!table) return;

    const sortedTransactions = [...transactions]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));


    if (sortedTransactions.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="5">No transactions recorded yet.</td>
            </tr>
        `;

        return;

    }


    table.innerHTML = sortedTransactions.map(transaction => {

        return `
            <tr>

                <td>${escapeHTML(transaction.id)}</td>

                <td>${escapeHTML(transaction.customerName)}</td>

                <td>${escapeHTML(transaction.type)}</td>

                <td>${escapeHTML(transaction.details)}</td>

                <td>${formatDate(transaction.createdAt)}</td>

            </tr>
        `;

    }).join("");

}


/* =====================================================
   18. LOYALTY SETTINGS
===================================================== */

function loadSettingsForm() {

    setText("sidebar-shop-name", settings.shopName);

    const shopName = getElement("setting-shop-name");

    const minimumPurchase = getElement(
        "setting-minimum-purchase"
    );

    const requiredStamps = getElement(
        "setting-required-stamps"
    );

    const rewardName = getElement(
        "setting-reward-name"
    );

    const rewardDescription = getElement(
        "setting-reward-description"
    );


    if (shopName) {
        shopName.value = settings.shopName;
    }

    if (minimumPurchase) {
        minimumPurchase.value = settings.minimumPurchase;
    }

    if (requiredStamps) {
        requiredStamps.value = settings.requiredStamps;
    }

    if (rewardName) {
        rewardName.value = settings.rewardName;
    }

    if (rewardDescription) {
        rewardDescription.value = settings.rewardDescription;
    }

}


function initializeSettingsForm() {

    const form = getElement("settings-form");

    if (!form) return;

    form.addEventListener("submit", async event => {

        event.preventDefault();


        const shopName = getElement(
            "setting-shop-name"
        ).value.trim();

        const minimumPurchase = Number(
            getElement("setting-minimum-purchase").value
        );

        const requiredStamps = Number(
            getElement("setting-required-stamps").value
        );

        const rewardName = getElement(
            "setting-reward-name"
        ).value.trim();

        const rewardDescription = getElement(
            "setting-reward-description"
        ).value.trim();


        if (
            !shopName ||
            !rewardName ||
            !Number.isFinite(minimumPurchase) ||
            minimumPurchase < 0 ||
            !Number.isInteger(requiredStamps) ||
            requiredStamps < 1
        ) {

            showToast("Please enter valid loyalty settings.", "error");

            return;

        }


        settings = {

            shopName,

            minimumPurchase,

            requiredStamps,

            rewardName,

            rewardDescription:
                rewardDescription ||
                "Collect stamps to unlock your reward."

        };


        try {
            await withAdminPinRetry(() => smsApiPost("saveSettings", { settings }));
            await refreshAdminData();
        } catch (error) {
            showToast(error.message || "Unable to save settings.", "error");
            return;
        }

        loadSettingsForm();

        updateDashboard();

        updatePurchaseRules();

        renderCustomers();

        renderRewards();

        showToast("Loyalty settings saved successfully!");

    });

}


/* =====================================================
   19. CURRENT DATE
===================================================== */

function displayCurrentDate() {

    const dateElement = getElement("current-date");

    if (!dateElement) return;

    dateElement.textContent = new Date().toLocaleDateString(
        "en-IN",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


/* =====================================================
   20. INITIALIZE APPLICATION
===================================================== */

async function initializeApp() {

    try {
        await loadData();
    } catch (error) {
        console.error("SMS backend connection failed:", error);
        showToast(error.message || "Could not connect to SMS backend.", "error");
        return;
    }

    initializeNavigation();

    initializeModals();

    initializeCustomerForm();

    initializeCustomerSearch();

    initializeCustomerActions();

    initializePurchaseForm();

    initializeScannerButtons();

    initializeQRDownload();

    initializeRewardActions();

    initializeSettingsForm();

    displayCurrentDate();

    loadSettingsForm();

    updateDashboard();

    renderCustomers();

    renderPurchases();

    renderRewards();

    renderTransactions();

    updatePurchaseRules();

    console.log("SMS Admin Dashboard initialized successfully.");

}


/* =====================================================
   21. START APPLICATION
===================================================== */

window.addEventListener("focus", async () => {
    if (!smsBackendReady) return;
    try {
        await refreshAdminData();
        updateDashboard(); renderCustomers(); renderPurchases(); renderRewards(); renderTransactions();
    } catch (error) { console.warn("Background refresh failed:", error); }
});


document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);
