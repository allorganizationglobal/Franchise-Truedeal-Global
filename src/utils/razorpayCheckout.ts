/**
 * Official Razorpay Standard Web Checkout Loader
 * Loads https://checkout.razorpay.com/v1/checkout.js dynamically once per browser session.
 */

export interface RazorpayCheckoutSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutFailedEvent {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number; // paise
  currency: 'INR';
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    confirm_close?: boolean;
  };
  handler: (response: RazorpayCheckoutSuccessResponse) => void;
}

export interface RazorpayCheckoutInstance {
  open: () => void;
  close?: () => void;
  on: (event: 'payment.failed', callback: (response: RazorpayCheckoutFailedEvent) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

const RAZORPAY_CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptLoadPromise: Promise<boolean> | null = null;

export function loadRazorpayCheckoutScript(timeoutMs = 15000): Promise<boolean> {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  if (typeof window.Razorpay === 'function') {
    return Promise.resolve(true);
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SCRIPT_URL}"]`
    );

    const timer = window.setTimeout(() => {
      scriptLoadPromise = null;
      resolve(false);
    }, timeoutMs);

    const finish = (ok: boolean) => {
      window.clearTimeout(timer);
      if (!ok) {
        scriptLoadPromise = null;
      }
      resolve(ok);
    };

    if (existing) {
      if (typeof window.Razorpay === 'function') {
        finish(true);
        return;
      }
      existing.addEventListener('load', () => finish(typeof window.Razorpay === 'function'), { once: true });
      existing.addEventListener('error', () => finish(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () => finish(typeof window.Razorpay === 'function');
    script.onerror = () => finish(false);
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}
