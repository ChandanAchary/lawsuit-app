/**
 * Razorpay checkout utility for React Native (Expo compatible).
 * Opens Razorpay checkout via a WebView-based modal.
 */

export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';

export interface RazorpayOrderOptions {
  orderId: string;
  amount: number; // in paise
  currency?: string;
  name?: string;
  description?: string;
  prefillEmail?: string;
  prefillPhone?: string;
  prefillName?: string;
  /** Internal payment record ID returned by addMoney — needed for confirm-add-money */
  paymentId?: string;
}

export interface RazorpayPaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Build the HTML page that loads Razorpay checkout.js and auto-opens the payment form.
 */
export function buildRazorpayCheckoutHTML(options: RazorpayOrderOptions): string {
  const {
    orderId,
    amount,
    currency = 'INR',
    name = 'NyayaX',
    description = 'Payment',
    prefillEmail = '',
    prefillPhone = '',
    prefillName = '',
  } = options;

  // Pre-flight checks. We surface these BEFORE handing off to the WebView
  // so the user gets a useful error instead of the eternal "Initializing
  // secure payment..." screen the original HTML showed when Razorpay
  // failed to open silently (empty key, missing order id, etc.).
  const keyIssue = !RAZORPAY_KEY_ID
    ? 'Razorpay key is missing. Set EXPO_PUBLIC_RAZORPAY_KEY_ID in your mobile .env and restart with `npx expo start -c`.'
    : !orderId
      ? 'Payment order id is missing. The server did not return providerOrderId — check the server\'s Razorpay key configuration.'
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .loading, .error {
      text-align: center;
      padding: 20px;
      max-width: 320px;
    }
    .loading h2 { color: #0B4D64; }
    .loading p { color: #64748b; }
    .error h3 { color: #ef4444; margin-bottom: 8px; }
    .error p { color: #475569; line-height: 1.5; font-size: 14px; }
    .retry-btn {
      margin-top: 16px;
      padding: 12px 24px;
      background: #0B4D64;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
    }
    .spin {
      display: inline-block;
      width: 28px; height: 28px;
      border: 3px solid #cbd5e1;
      border-top-color: #0B4D64;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading" id="loadingDiv">
    <div class="spin"></div>
    <h2>NyayaX</h2>
    <p id="loadingMsg">Initializing secure payment...</p>
  </div>
  <div class="error" id="errorDiv" style="display:none;">
    <h3>Payment could not be processed</h3>
    <p id="errorMsg"></p>
    <button class="retry-btn" onclick="openCheckout()">Retry</button>
    <br/><br/>
    <button class="retry-btn" style="background:#64748b;" onclick="cancelToHost()">Cancel</button>
  </div>

  <script>
    // ---- Helpers ----
    function postMsg(ev, data) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ event: ev, data: data || {} }));
        }
      } catch (e) {}
    }
    function showError(msg) {
      var loading = document.getElementById('loadingDiv');
      var errorDiv = document.getElementById('errorDiv');
      var errorMsg = document.getElementById('errorMsg');
      if (loading) loading.style.display = 'none';
      if (errorDiv) errorDiv.style.display = 'block';
      if (errorMsg) errorMsg.textContent = msg || 'Unknown error';
    }
    function showLoading(msg) {
      var loading = document.getElementById('loadingDiv');
      var errorDiv = document.getElementById('errorDiv');
      var loadingMsg = document.getElementById('loadingMsg');
      if (loading) loading.style.display = 'block';
      if (errorDiv) errorDiv.style.display = 'none';
      if (loadingMsg && msg) loadingMsg.textContent = msg;
    }
    function cancelToHost() {
      postMsg('cancelled');
    }

    // ---- Pre-flight gate ----
    var KEY_ISSUE = ${JSON.stringify(keyIssue)};
    if (KEY_ISSUE) {
      // Surface a clear error in the WebView AND notify the host so the
      // outer Alert can also show it.
      showError(KEY_ISSUE);
      postMsg('error', { description: KEY_ISSUE });
    }

    // ---- Razorpay loader ----
    // Use explicit load/error handlers so a network/CSP failure doesn't
    // leave the user staring at "Initializing secure payment..." forever.
    var sdkReady = false;
    var sdkLoadTimeout = null;

    function onSdkLoad() {
      sdkReady = true;
      if (sdkLoadTimeout) { clearTimeout(sdkLoadTimeout); sdkLoadTimeout = null; }
      if (typeof Razorpay === 'undefined') {
        showError('Payment SDK loaded but is not initialized. Try again.');
        return;
      }
      openCheckout();
    }
    function onSdkError() {
      if (sdkLoadTimeout) { clearTimeout(sdkLoadTimeout); sdkLoadTimeout = null; }
      var msg = 'Failed to load checkout.js. Check your internet connection and try again.';
      showError(msg);
      postMsg('error', { description: msg });
    }

    function loadSdk() {
      if (KEY_ISSUE) return;
      if (sdkReady && typeof Razorpay !== 'undefined') {
        openCheckout();
        return;
      }
      var s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = onSdkLoad;
      s.onerror = onSdkError;
      document.head.appendChild(s);
      // 12-second hard timeout so a hung request surfaces as an error.
      sdkLoadTimeout = setTimeout(function() {
        if (!sdkReady) onSdkError();
      }, 12000);
    }

    function openCheckout() {
      if (KEY_ISSUE) { showError(KEY_ISSUE); return; }
      if (typeof Razorpay === 'undefined') { loadSdk(); return; }
      showLoading('Opening payment...');
      try {
        var options = {
          key: ${JSON.stringify(RAZORPAY_KEY_ID)},
          amount: ${amount},
          currency: ${JSON.stringify(currency)},
          name: ${JSON.stringify(name)},
          description: ${JSON.stringify(description)},
          order_id: ${JSON.stringify(orderId)},
          prefill: {
            name: ${JSON.stringify(prefillName)},
            email: ${JSON.stringify(prefillEmail)},
            contact: ${JSON.stringify(prefillPhone)}
          },
          theme: { color: '#0B4D64' },
          handler: function(response) {
            postMsg('success', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });
          },
          modal: {
            ondismiss: function() { postMsg('cancelled'); },
            escape: false,
            confirm_close: true
          }
        };
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
          var err = (response && response.error) || {};
          postMsg('error', {
            code: err.code,
            description: err.description,
            reason: err.reason
          });
        });
        rzp.open();
      } catch(e) {
        showError(e && e.message ? e.message : 'Unable to open checkout.');
      }
    }

    // Kick the SDK load on page ready.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadSdk);
    } else {
      loadSdk();
    }
  </script>
</body>
</html>`;
}
