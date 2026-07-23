"use strict";

(function () {
  function qs(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }


  function getPendingPayment(reservationCode) {
    if (!reservationCode) return null;
    const key = `mct_pending_payment_${reservationCode}`;
    try {
      return JSON.parse(sessionStorage.getItem(key) || localStorage.getItem(key) || "null");
    } catch (error) {
      return null;
    }
  }

  function firstNumber(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) return number;
    }
    return 0;
  }

  function trackPurchase(result, token, fallbackReservationCode) {
    if (typeof window.mctTrack !== "function") return;

    const finalCode = result?.reservationCode || fallbackReservationCode || "";
    const pending = getPendingPayment(finalCode);
    const payload = pending?.payload || {};
    const voucher = result?.voucher || {};
    const productTitle = result?.productTitle || payload.productTitle || voucher.productTitle || voucher.productName || voucher.tourName || "My Cusco Trip booking";
    const productId = result?.productId || payload.productId || voucher.productId || voucher.productCode || finalCode || "booking";
    const currency = result?.currency || payload.currency || voucher.currency || "USD";
    const value = firstNumber(
      result?.amount,
      result?.amountValue,
      result?.paidAmount,
      result?.total,
      payload.payNowValue,
      payload.amountToPayNowValue,
      voucher.payNowValue,
      voucher.totalValue,
      voucher.total
    );

    const transactionId = result?.paypalOrderId || result?.orderId || token || finalCode;
    const purchaseKey = `mct_purchase_tracked_paypal_${transactionId}`;
    try {
      if (transactionId && localStorage.getItem(purchaseKey)) return;
    } catch (error) {}

    window.mctTrack("purchase", {
      transaction_id: transactionId,
      reservation_code: finalCode,
      item_id: productId,
      item_name: productTitle,
      item_category: payload.productType || voucher.productType || "tour",
      currency,
      value,
      payment_provider: "paypal",
      items: [{
        item_id: productId,
        item_name: productTitle,
        item_category: payload.productType || voucher.productType || "tour",
        quantity: 1,
        price: value
      }]
    }, { metaEventName: "Purchase", tiktokEventName: "CompletePayment" });

    try {
      if (transactionId) localStorage.setItem(purchaseKey, "1");
    } catch (error) {}
  }

  function setCard(state, title, message, code, actionsHtml) {
    const card = document.getElementById("paymentReturnCard");
    const codeTarget = document.getElementById("paymentReturnCode");
    const actions = document.getElementById("paymentReturnActions");
    if (!card) return;
    card.classList.toggle("payment-return__error", state === "error");
    const icon = state === "success" ? "✓" : state === "error" ? "!" : "…";
    card.querySelector(".payment-return__icon").textContent = icon;
    card.querySelector("h1").textContent = title;
    card.querySelector("p").textContent = message;
    if (codeTarget) {
      codeTarget.hidden = !code;
      codeTarget.textContent = code ? `Código de reserva: ${code}` : "";
    }
    if (actions) {
      actions.hidden = !actionsHtml;
      actions.innerHTML = actionsHtml || "";
    }
  }

  async function main() {
    const token = qs("token") || qs("orderID") || qs("orderId");
    const reservationCode = qs("reservationCode") || qs("codigo") || "";
    const cancelled = qs("cancelled") || qs("cancel") || "";

    if (cancelled) {
      setCard(
        "error",
        "Pago cancelado",
        "La orden de PayPal fue cancelada. Tu pre-reserva seguirá pendiente hasta su fecha de vencimiento.",
        reservationCode,
        `<a class="btn btn-primary" href="./mi-reserva.html">Ir a Mi Reserva</a>`
      );
      return;
    }

    if (!token) {
      setCard(
        "error",
        "No encontramos la orden de PayPal",
        "PayPal no devolvió un identificador de orden válido. Revisa tu reserva o contáctanos por WhatsApp.",
        reservationCode,
        `<a class="btn btn-primary" href="./mi-reserva.html">Consultar mi reserva</a>`
      );
      return;
    }

    try {
      const result = await window.MyCuscoTripApiClient.capturePayPalOrder(token, { reservationCode });
      if (!result?.paid) throw new Error(result?.message || result?.error || "El pago aún no figura como completado.");

      if (result.voucher) {
        try {
          localStorage.setItem("reservaSeleccionada", JSON.stringify(result.voucher));
          localStorage.setItem(`mct_voucher_${result.reservationCode}`, JSON.stringify(result.voucher));
        } catch (storageError) {}
      }

      const finalCode = result.reservationCode || reservationCode;
      trackPurchase(result, token, finalCode);
      setCard(
        "success",
        "Reserva confirmada",
        "Recibimos tu pago correctamente. También enviamos la confirmación y el enlace del travel voucher al correo del titular.",
        finalCode,
        `<a class="btn btn-primary" href="./detalle-reserva.html?codigo=${encodeURIComponent(finalCode)}">Ver mi travel voucher</a><a class="btn btn-secondary" href="./mi-reserva.html">Ir a Mi Reserva</a>`
      );
    } catch (error) {
      console.error("No se pudo capturar el pago:", error);
      setCard(
        "error",
        "No pudimos confirmar el pago todavía",
        error.message || "Revisa tu conexión o consulta tu reserva con el código CUZ y tu apellido.",
        reservationCode,
        `<a class="btn btn-primary" href="./mi-reserva.html">Consultar mi reserva</a>`
      );
    }
  }

  document.addEventListener("DOMContentLoaded", main);
})();
