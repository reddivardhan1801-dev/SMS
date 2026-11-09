/* =========================================
   SMS - CUSTOMER LOYALTY PAGE
   Google Apps Script backend integration
========================================= */

/* 1. CONFIGURATION */

const DEFAULT_REWARD = {
    name: "Free Screen Guard",
    description: "Collect all the stamps to unlock this reward.",
    requiredStamps: 5
};

const SMS_API_URL = "https://script.google.com/macros/s/AKfycbzDuEEL4A3z61OMktFnnOQG59-OY8jaP7TPMaOEG0-dhf13d9dnkWmjvFIP-SCJyudT/exec";

/* 2. GET CUSTOMER TOKEN */

const urlParams = new URLSearchParams(window.location.search);
const customerToken = urlParams.get("token");

/* 3. DOM ELEMENTS */

const elements = {
    shopName: document.getElementById("shop-name"),
    customerName: document.getElementById("customer-name"),
    cardCustomerName: document.getElementById("card-customer-name"),
    membershipId: document.getElementById("membership-id"),
    stampCount: document.getElementById("stamp-count"),
    stampGrid: document.getElementById("stamp-grid"),
    progressFill: document.getElementById("progress-fill"),
    progressText: document.getElementById("progress-text"),
    rewardName: document.getElementById("reward-name"),
    rewardDescription: document.getElementById("reward-description"),
    rewardStatus: document.getElementById("reward-status"),
    redemptionInformation: document.getElementById("redemption-information")
};

let currentCustomer = null;
let currentSettings = null;
let currentLatestRequest = null;
let isLoading = false;
let isSubmittingRedemption = false;

/* 4. BACKEND HELPERS */

async function smsApiGet(action, params = {}) {
    const url = new URL(SMS_API_URL);
    url.searchParams.set("action", action);

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), {
        method: "GET",
        redirect: "follow",
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`Server request failed (${response.status}).`);
    }

    const data = await response.json();

    if (!data.ok) {
        throw new Error(data.error || "Unable to load membership details.");
    }

    return data;
}

async function smsApiPost(action, payload = {}) {
    const response = await fetch(SMS_API_URL, {
        method: "POST",
        redirect: "follow",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) {
        throw new Error(`Server request failed (${response.status}).`);
    }

    const data = await response.json();

    if (!data.ok) {
        throw new Error(data.error || "The request could not be completed.");
    }

    return data;
}

/* 5. SAFE HTML TEXT */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

/* 6. SHOW ERROR MESSAGE */

function showError(message) {
    const container = document.querySelector(".customer-container");
    if (!container) return;

    container.innerHTML = `
        <section class="customer-error">
            <div class="error-icon">!</div>
            <h2>Membership Card Not Found</h2>
            <p>${escapeHTML(message)}</p>
            <p>Please contact the shopkeeper for assistance.</p>
        </section>
    `;
}

/* 7. LOAD CUSTOMER DATA FROM BACKEND */

async function loadCustomerData() {
    if (!customerToken) {
        throw new Error("No membership token was found in this QR code.");
    }

    const data = await smsApiGet("getCustomer", {
        token: customerToken
    });

    currentCustomer = data.customer;
    currentSettings = {
        ...DEFAULT_REWARD,
        ...(data.settings || {})
    };
    currentLatestRequest = data.latestRequest || null;

    if (!currentCustomer) {
        throw new Error("We couldn't find a membership associated with this QR code.");
    }

    if (currentCustomer.status === "blocked") {
        throw new Error("This membership card has been deactivated. Please contact the shopkeeper.");
    }

    return {
        customer: currentCustomer,
        settings: currentSettings,
        latestRequest: currentLatestRequest
    };
}

/* 8. DISPLAY CUSTOMER INFORMATION */

function displayCustomer(customer, settings) {
    if (elements.shopName) {
        elements.shopName.textContent = settings.shopName || "Loyalty Club";
    }

    if (elements.customerName) {
        elements.customerName.textContent = customer.name || "";
    }

    if (elements.cardCustomerName) {
        elements.cardCustomerName.textContent = customer.name || "";
    }

    if (elements.membershipId) {
        elements.membershipId.textContent = customer.membershipId || "SMS000001";
    }
}

/* 9. GENERATE STAMP SLOTS */

function generateStamps(customer, settings) {
    const totalStamps = Math.max(
        1,
        Number(settings.requiredStamps) || DEFAULT_REWARD.requiredStamps
    );

    const collectedStamps = Math.min(
        Math.max(Number(customer.stamps) || 0, 0),
        totalStamps
    );

    if (elements.stampGrid) {
        elements.stampGrid.innerHTML = "";

        for (let i = 1; i <= totalStamps; i++) {
            const stamp = document.createElement("div");
            stamp.classList.add("stamp-slot");

            if (i <= collectedStamps) {
                stamp.classList.add("stamp-collected");
                stamp.innerHTML = `<span>✓</span><small>${i}</small>`;
            } else {
                stamp.classList.add("stamp-empty");
                stamp.innerHTML = `<span>${i}</span>`;
            }

            elements.stampGrid.appendChild(stamp);
        }
    }

    if (elements.stampCount) {
        elements.stampCount.textContent = `${collectedStamps}/${totalStamps}`;
    }

    return collectedStamps;
}

/* 10. UPDATE PROGRESS BAR */

function updateProgress(collectedStamps, settings) {
    const totalStamps = Math.max(
        1,
        Number(settings.requiredStamps) || DEFAULT_REWARD.requiredStamps
    );

    const percentage = Math.min((collectedStamps / totalStamps) * 100, 100);

    if (elements.progressFill) {
        elements.progressFill.style.width = `${percentage}%`;
    }

    if (elements.progressText) {
        if (collectedStamps >= totalStamps) {
            elements.progressText.textContent =
                "Congratulations! You have unlocked your reward.";
        } else {
            const remaining = totalStamps - collectedStamps;
            elements.progressText.textContent =
                `Only ${remaining} more stamp${remaining === 1 ? "" : "s"} to unlock your reward!`;
        }
    }
}

/* 11. REQUEST REWARD REDEMPTION */

async function requestRewardRedemption() {
    if (isSubmittingRedemption || !customerToken) return;

    const button = document.getElementById("redeem-at-shop-button");
    isSubmittingRedemption = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Submitting...";
    }

    try {
        await smsApiPost("requestRedemption", {
            token: customerToken
        });

        await refreshCustomerPage();
    } catch (error) {
        alert(error.message || "Unable to submit your redemption request.");
        if (button) {
            button.disabled = false;
            button.textContent = "Redeem at Shop";
        }
    } finally {
        isSubmittingRedemption = false;
    }
}

/* 12. DISPLAY REDEMPTION INFORMATION */

function renderRedemptionInformation(customer, settings, latestRequest) {
    if (!elements.redemptionInformation || !elements.rewardStatus ||
        !elements.rewardDescription) return;

    const collectedStamps = Number(customer.stamps) || 0;
    const requiredStamps = Number(settings.requiredStamps) || DEFAULT_REWARD.requiredStamps;
    const rewardUnlocked = collectedStamps >= requiredStamps;
    const rewardRedeemed = customer.rewardRedeemed === true ||
        String(customer.rewardRedeemed).toLowerCase() === "true";

    elements.redemptionInformation.innerHTML = "";

    if (rewardRedeemed) {
        elements.rewardStatus.textContent = "Redeemed";
        elements.rewardStatus.classList.remove("reward-unlocked");
        elements.rewardStatus.classList.add("reward-redeemed");
        elements.rewardDescription.textContent =
            "Your reward has already been redeemed. Keep shopping for more rewards!";

        elements.redemptionInformation.innerHTML = `
            <div class="redemption-success">
                <h3>Reward Redeemed Successfully!</h3>
                <p>Your shopkeeper has confirmed your reward redemption. Thank you for being a loyal customer!</p>
            </div>
        `;
        return;
    }

    elements.rewardStatus.classList.remove("reward-unlocked", "reward-redeemed");

    if (!rewardUnlocked) {
        elements.rewardStatus.textContent = "Locked";
        elements.rewardDescription.textContent =
            settings.rewardDescription || DEFAULT_REWARD.description;

        elements.redemptionInformation.innerHTML = `
            <div class="redemption-locked">
                <h3>How to redeem your reward?</h3>
                <p>Collect all ${requiredStamps} stamps. Once unlocked, visit the shop to claim your reward.</p>
            </div>
        `;
        return;
    }

    elements.rewardStatus.textContent = "Unlocked";
    elements.rewardStatus.classList.add("reward-unlocked");
    elements.rewardDescription.textContent =
        settings.rewardDescription || DEFAULT_REWARD.description;

    if (latestRequest && latestRequest.status === "pending") {
        elements.redemptionInformation.innerHTML = `
            <div class="redemption-pending">
                <h3>Redemption Request Submitted</h3>
                <p>Your request for <strong>${escapeHTML(settings.rewardName)}</strong> is waiting for shopkeeper confirmation.</p>
                <p class="redemption-note">Please visit the shop and show your membership card.</p>
                <span class="redemption-status">Request Pending</span>
            </div>
        `;
        return;
    }

    if (latestRequest && latestRequest.status === "rejected") {
        elements.redemptionInformation.innerHTML = `
            <div class="redemption-ready">
                <h3>Your Reward Is Ready!</h3>
                <p>Your previous request was not approved. You can submit another request or contact the shop.</p>
                <button type="button" class="redeem-at-shop-button" id="redeem-at-shop-button">Redeem at Shop</button>
            </div>
        `;
    } else {
        elements.redemptionInformation.innerHTML = `
            <div class="redemption-ready">
                <h3>Congratulations! 🎉</h3>
                <p>You have unlocked <strong>${escapeHTML(settings.rewardName)}</strong>.</p>
                <p>Visit the shop and request your reward. The shopkeeper will confirm your redemption.</p>
                <button type="button" class="redeem-at-shop-button" id="redeem-at-shop-button">Redeem at Shop</button>
            </div>
        `;
    }

    const redeemButton = document.getElementById("redeem-at-shop-button");
    if (redeemButton) {
        redeemButton.addEventListener("click", requestRewardRedemption);
    }
}

/* 13. REFRESH CUSTOMER PAGE */

async function refreshCustomerPage() {
    if (isLoading) return;
    isLoading = true;

    try {
        const { customer, settings, latestRequest } = await loadCustomerData();

        displayCustomer(customer, settings);
        const collectedStamps = generateStamps(customer, settings);
        updateProgress(collectedStamps, settings);

        if (elements.rewardName) {
            elements.rewardName.textContent = settings.rewardName;
        }

        renderRedemptionInformation(customer, settings, latestRequest);
    } catch (error) {
        showError(error.message || "Unable to load your membership. Please try again.");
    } finally {
        isLoading = false;
    }
}

/* 14. INITIALIZE CUSTOMER PAGE */

function initializeCustomerPage() {
    refreshCustomerPage();
}

/* 15. AUTO-REFRESH CUSTOMER STATUS */

document.addEventListener("visibilitychange", () => {
    if (!document.hidden && customerToken) {
        refreshCustomerPage();
    }
});

/* 16. START CUSTOMER PAGE */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCustomerPage);
} else {
    initializeCustomerPage();
}

/* Refresh periodically so customer sees shopkeeper approvals/rejections. */
setInterval(() => {
    if (!document.hidden && customerToken && !isSubmittingRedemption) {
        refreshCustomerPage();
    }
}, 30000);
