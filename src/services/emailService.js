const { BRAND } = require("../utils/storeSeo");

/**
 * Outbound email.
 *
 * Same shape as the Razorpay and Shiprocket services: it works without
 * credentials so nothing in the app breaks, and switches to real delivery the
 * moment SMTP details land in .env.
 *
 * Three transports, chosen in this order:
 *   1. SMTP via nodemailer, when SMTP_HOST and SMTP_USER are set.
 *   2. Console, otherwise — the whole message is printed to the server log,
 *      including any reset link, so the flow is fully testable in development
 *      without a mail account.
 *   3. Silent, when EMAIL_TRANSPORT=off — for tests that shouldn't be noisy.
 *
 * Nothing here ever throws into a request. A saree that sold successfully must
 * not report failure because a confirmation email bounced, so every send is
 * wrapped and failures are logged and returned as { sent: false }.
 */

const FROM = () => process.env.EMAIL_FROM || `${BRAND} <no-reply@wovenessence.in>`;

/** Public base URL used in links. Falls back to localhost for development. */
const siteUrl = () => (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");

function transportKind() {
  if (process.env.EMAIL_TRANSPORT === "off") return "off";
  if (process.env.SMTP_HOST && process.env.SMTP_USER) return "smtp";
  return "console";
}

let cachedTransport = null;

function smtpTransport() {
  if (cachedTransport) return cachedTransport;

  let nodemailer;
  try {
    // Required lazily so the app runs fine when the package isn't installed.
    // eslint-disable-next-line global-require
    nodemailer = require("nodemailer");
  } catch {
    console.warn(
      "[email] SMTP_HOST is set but nodemailer isn't installed.\n" +
        "        Run:  npm install nodemailer\n" +
        "        Falling back to printing emails to this log."
    );
    return null;
  }

  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    // Port 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: String(process.env.SMTP_SECURE || "") === "true" || Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  return cachedTransport;
}

/** Strips tags for the plain-text alternative, so the mail isn't HTML-only. */
function toPlainText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    // A cell boundary needs whitespace or "Courier" and "Delhivery" run
    // together in the plain-text alternative.
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<\/(p|h1|h2|h3|tr|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8377;|&rupee;/g, "Rs ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, arr) => l || arr[i - 1])
    .join("\n")
    .trim();
}

async function send({ to, subject, html, replyTo }) {
  if (!to) return { sent: false, reason: "no recipient" };

  const kind = transportKind();
  const message = {
    from: FROM(),
    to,
    subject,
    html,
    text: toPlainText(html),
    ...(replyTo ? { replyTo } : {}),
  };

  if (kind === "off") return { sent: false, reason: "transport off" };

  if (kind === "console") {
    console.log(
      "\n──────── email (not sent — no SMTP configured) ────────\n" +
        `to:      ${to}\n` +
        `subject: ${subject}\n\n` +
        `${message.text}\n` +
        "───────────────────────────────────────────────────────\n"
    );
    return { sent: false, reason: "console transport", preview: message.text };
  }

  const transport = smtpTransport();
  if (!transport) return { sent: false, reason: "nodemailer missing" };

  try {
    const info = await transport.sendMail(message);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    // Never surface a mail failure into the customer's request.
    console.error(`[email] failed to send "${subject}" to ${to}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

/* ── shared chrome ─────────────────────────────────────────────────────────── */

/**
 * Inline styles only, and a table-free layout where possible.
 *
 * Email clients strip <style> blocks and external CSS, and Gmail in particular
 * drops anything it doesn't recognise — so every rule sits on the element.
 */
function layout({ heading, intro, bodyHtml = "", ctaLabel, ctaUrl, footerNote }) {
  const gold = "#A9791F";
  const oxblood = "#6B1F2A";
  const ink = "#1C1614";

  return `<div style="margin:0;padding:24px 12px;background:#FAF6EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${ink}">
  <div style="max-width:560px;margin:0 auto;background:#FFFDF9;border:1px solid #E3D9C8;border-radius:4px;overflow:hidden">
    <div style="background:${oxblood};padding:18px 24px">
      <div style="color:#FAF6EF;font-size:20px;letter-spacing:.5px">${BRAND}</div>
      <div style="color:${gold};font-size:10px;letter-spacing:1.6px;text-transform:uppercase;margin-top:2px">Temple Fabric Sarees</div>
    </div>
    <div style="height:3px;background:repeating-linear-gradient(90deg,${gold} 0 6px,transparent 6px 10px,#C9A24B 10px 12px,transparent 12px 18px)"></div>

    <div style="padding:26px 24px">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:${ink}">${heading}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#4A403A">${intro}</p>
      ${bodyHtml}
      ${
        ctaLabel && ctaUrl
          ? `<div style="margin:24px 0 8px">
               <a href="${ctaUrl}" style="display:inline-block;background:${oxblood};color:#FAF6EF;text-decoration:none;padding:12px 22px;border-radius:3px;font-size:14px;font-weight:500">${ctaLabel}</a>
             </div>
             <p style="margin:12px 0 0;font-size:11px;color:#8A7D6D;word-break:break-all">Or paste this into your browser:<br>${ctaUrl}</p>`
          : ""
      }
    </div>

    ${
      footerNote
        ? `<div style="padding:14px 24px;background:#F2EADC;font-size:11px;line-height:1.6;color:#8A7D6D">${footerNote}</div>`
        : ""
    }
    <div style="padding:14px 24px;border-top:1px solid #E3D9C8;font-size:11px;color:#8A7D6D">
      © ${new Date().getFullYear()} ${BRAND}. Woven in India.
    </div>
  </div>
</div>`;
}

/** Money for email — no Intl dependency on the recipient's client. */
function money(n) {
  const value = Number(n || 0);
  return "Rs " + value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function lineRows(lines = []) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;margin:8px 0 0">
    ${lines
      .map(
        (l) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #E3D9C8;color:#1C1614">
          ${l.productName || "Saree"}
          <div style="color:#8A7D6D;font-size:11px">${l.itemCode || ""}${l.quantity > 1 ? ` &nbsp;×${l.quantity}` : ""}</div>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #E3D9C8;text-align:right;white-space:nowrap">${money(l.lineSubtotal)}</td>
      </tr>`
      )
      .join("")}
  </table>`;
}

function addressBlock(a = {}) {
  return `<div style="margin:14px 0 0;padding:12px 14px;background:#FAF6EF;border:1px solid #E3D9C8;border-radius:3px;font-size:13px;line-height:1.6">
    <strong style="display:block">${a.fullName || ""}</strong>
    ${[a.line1, a.line2].filter(Boolean).join(", ")}<br>
    ${[a.city, a.state, a.pincode].filter(Boolean).join(", ")}<br>
    ${a.phone || ""}
  </div>`;
}

/* ── the emails ────────────────────────────────────────────────────────────── */

/**
 * Password reset.
 *
 * The link carries a single-use token; the wording deliberately reassures a
 * recipient who didn't ask for it, since password-reset mail is a common
 * phishing shape and people are right to be wary.
 */
function passwordResetEmail({ name, resetUrl, expiryMinutes }) {
  return {
    subject: `Reset your ${BRAND} password`,
    html: layout({
      heading: "Reset your password",
      intro: `Hello ${name || "there"}, we received a request to reset the password on your ${BRAND} account.`,
      ctaLabel: "Choose a new password",
      ctaUrl: resetUrl,
      footerNote:
        `This link works once and expires in ${expiryMinutes} minutes. ` +
        `If you didn't ask for a reset you can ignore this email — your password stays as it is, ` +
        `and nobody can use this link to sign in without it.`,
    }),
  };
}

function orderPlacedEmail({ order, isCod }) {
  const trackUrl = `${siteUrl()}/orders/${order.orderNumber}`;
  return {
    subject: `Order ${order.orderNumber} confirmed — ${BRAND}`,
    html: layout({
      heading: "Thank you — your order is confirmed",
      intro: `Hello ${order.customerName || "there"}, we've received your order and the ${
        order.branchName || "store"
      } team is preparing it.`,
      bodyHtml: `
        ${lineRows(order.lines)}
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin:12px 0 0">
          <tr><td style="padding:4px 0;color:#4A403A">Order total</td>
              <td style="padding:4px 0;text-align:right;font-weight:600">${money(order.amounts?.grandTotal)}</td></tr>
          <tr><td style="padding:4px 0;color:#8A7D6D;font-size:12px">Payment</td>
              <td style="padding:4px 0;text-align:right;color:#8A7D6D;font-size:12px">${
                isCod ? "Cash on delivery" : "Paid online"
              }</td></tr>
        </table>
        <p style="margin:18px 0 0;font-size:13px;color:#4A403A">Delivering to</p>
        ${addressBlock(order.shippingAddress)}
      `,
      ctaLabel: "Track this order",
      ctaUrl: trackUrl,
      footerNote: isCod
        ? `Please have ${money(order.amounts?.grandTotal)} ready for the delivery agent.`
        : "We'll email you again the moment it's handed to the courier.",
    }),
  };
}

function orderShippedEmail({ order }) {
  const s = order.shipment || {};
  return {
    subject: `Order ${order.orderNumber} is on its way — ${BRAND}`,
    html: layout({
      heading: "Your saree is on its way",
      intro: `Hello ${order.customerName || "there"}, order ${order.orderNumber} has left our ${
        order.branchCity || order.branchName || "store"
      } store.`,
      bodyHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;margin:6px 0 0">
          ${s.courierName ? `<tr><td style="padding:5px 0;color:#8A7D6D">Courier</td><td style="padding:5px 0;text-align:right">${s.courierName}</td></tr>` : ""}
          ${s.awbCode ? `<tr><td style="padding:5px 0;color:#8A7D6D">Tracking number</td><td style="padding:5px 0;text-align:right">${s.awbCode}</td></tr>` : ""}
          ${
            s.expectedDeliveryAt
              ? `<tr><td style="padding:5px 0;color:#8A7D6D">Expected</td><td style="padding:5px 0;text-align:right">${new Date(
                  s.expectedDeliveryAt
                ).toDateString()}</td></tr>`
              : ""
          }
        </table>
        ${addressBlock(order.shippingAddress)}
      `,
      ctaLabel: s.trackingUrl ? "Track with the courier" : "See order status",
      ctaUrl: s.trackingUrl || `${siteUrl()}/orders/${order.orderNumber}`,
    }),
  };
}

function orderDeliveredEmail({ order }) {
  return {
    subject: `Delivered — order ${order.orderNumber} | ${BRAND}`,
    html: layout({
      heading: "Delivered",
      intro: `Hello ${order.customerName || "there"}, order ${order.orderNumber} has been delivered. We hope you love it.`,
      bodyHtml: order.invoiceNumber
        ? `<p style="margin:0;font-size:13px;color:#4A403A">Your GST invoice ${order.invoiceNumber} is ready to download from your order page.</p>`
        : "",
      ctaLabel: "View order & invoice",
      ctaUrl: `${siteUrl()}/orders/${order.orderNumber}`,
      footerNote: `Something not right? Reply to this email and the ${
        order.branchName || "store"
      } team will help.`,
    }),
  };
}

function orderCancelledEmail({ order, reason }) {
  return {
    subject: `Order ${order.orderNumber} cancelled — ${BRAND}`,
    html: layout({
      heading: "Your order has been cancelled",
      intro: `Hello ${order.customerName || "there"}, order ${order.orderNumber} has been cancelled${
        reason ? ` — ${reason}` : ""
      }.`,
      bodyHtml:
        order.payment?.status === "paid"
          ? `<p style="margin:0;font-size:13px;color:#4A403A">Any amount you paid (${money(
              order.amounts?.grandTotal
            )}) will be refunded to your original payment method.</p>`
          : "",
      ctaLabel: "Browse sarees",
      ctaUrl: siteUrl(),
    }),
  };
}

/* ── convenience senders ───────────────────────────────────────────────────── */

const sendPasswordReset = (to, data) => send({ to, ...passwordResetEmail(data) });
const sendOrderPlaced = (order, isCod) =>
  send({ to: order.customerEmail, ...orderPlacedEmail({ order, isCod }) });
const sendOrderShipped = (order) => send({ to: order.customerEmail, ...orderShippedEmail({ order }) });
const sendOrderDelivered = (order) => send({ to: order.customerEmail, ...orderDeliveredEmail({ order }) });
const sendOrderCancelled = (order, reason) =>
  send({ to: order.customerEmail, ...orderCancelledEmail({ order, reason }) });

module.exports = {
  send,
  siteUrl,
  transportKind,
  isConfigured: () => transportKind() === "smtp",
  sendPasswordReset,
  sendOrderPlaced,
  sendOrderShipped,
  sendOrderDelivered,
  sendOrderCancelled,
};
