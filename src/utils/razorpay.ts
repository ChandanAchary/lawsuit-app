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
    name = 'LawSuit',
    description = 'Payment',
    prefillEmail = '',
    prefillPhone = '',
    prefillName = '',
  } = options;

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
    .loading {
      text-align: center;
      color: #64748b;
    }
    .loading h2 { color: #0B4D64; }
    .error { 
      text-align: center; 
      color: #ef4444; 
      padding: 20px;
    }
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
  </style>
</head>
<body>
  <div class="loading" id="loadingDiv">
    <h2>LawSuit</h2>
    <p>Initializing secure payment...</p>
  </div>
  <div class="error" id="errorDiv" style="display:none;">
    <h3>Payment could not be processed</h3>
    <p id="errorMsg"></p>
    <button class="retry-btn" onclick="openCheckout()">Retry</button>
    <br/><br/>
    <button class="retry-btn" style="background:#64748b;" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({event:'cancelled'}))">Cancel</button>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function openCheckout() {
      document.getElementById('loadingDiv').style.display = 'block';
      document.getElementById('errorDiv').style.display = 'none';
      try {
        var options = {
          key: '${RAZORPAY_KEY_ID}',
          amount: ${amount},
          currency: '${currency}',
          name: '${name}',
          description: '${description}',
          order_id: '${orderId}',
          prefill: {
            name: '${prefillName}',
            email: '${prefillEmail}',
            contact: '${prefillPhone}'
          },
          theme: { color: '#0B4D64' },
          handler: function(response) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              event: 'success',
              data: {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              }
            }));
          },
          modal: {
            ondismiss: function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({event:'cancelled'}));
            },
            escape: false,
            confirm_close: true
          }
        };
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            event: 'error',
            data: { 
              code: response.error.code,
              description: response.error.description,
              reason: response.error.reason 
            }
          }));
        });
        rzp.open();
      } catch(e) {
        document.getElementById('loadingDiv').style.display = 'none';
        document.getElementById('errorDiv').style.display = 'block';
        document.getElementById('errorMsg').textContent = e.message || 'Unknown error';
      }
    }
    // Auto-open on load
    openCheckout();
  </script>
</body>
</html>`;
}
