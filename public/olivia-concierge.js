(() => {
  const widget = document.getElementById("olivia-widget");
  if (!widget || widget.dataset.ready === "true") return;
  widget.dataset.ready = "true";

  const language = widget.dataset.language || "es";
  const clientCode = "suitesmine";
  const chatEndpoint = widget.dataset.chatEndpoint;
  const inboxEndpoint = widget.dataset.inboxEndpoint;
  const identityEndpoint = new URL("/api/widget/identity", chatEndpoint).href;
  const copy = {
    es: {
      name: "Olivia AI Concierge", open: "Abrir Olivia AI", close: "Cerrar Olivia AI",
      placeholder: "Escriba su pregunta...", send: "Enviar",
      welcome: "Hola, soy Olivia AI. Puedo responder sus preguntas y transmitir su solicitud al equipo de Suites Mine. Solo el hotel puede gestionar y confirmar una reserva.",
      actions: [["Contactar al hotel", "Quiero enviar una solicitud al hotel"], ["Habitaciones", "¿Qué tipos de habitaciones ofrecen?"], ["Servicios", "¿Qué servicios ofrecen?"], ["Mi reserva", "Necesito ayuda con una reserva existente"]],
      error: "Olivia no pudo responder. Intente de nuevo o contacte a contacto@suitesmine.com / +52 55 3666 8535.",
      review: "Revise su solicitud para el hotel", fullName: "Nombre y apellido", email: "Email",
      phone: "Teléfono (opcional)", request: "Su solicitud", submit: "Enviar mi solicitud al hotel",
      notice: "Sus datos y su solicitud se enviarán al equipo de Suites Mine. Esto no crea, modifica ni confirma una reserva.",
      sent: "Su solicitud ha sido transmitida mediante el formulario de contacto de Suites Mine. El hotel debe responder y confirmar cualquier gestión de reserva.",
      sendError: "No se pudo transmitir su solicitud. No se ha confirmado el envío. Intente de nuevo o escriba a contacto@suitesmine.com.",
      typing: "Olivia está escribiendo",
    },
    en: {
      name: "Olivia AI Concierge", open: "Open Olivia AI", close: "Close Olivia AI",
      placeholder: "Ask your question...", send: "Send",
      welcome: "Hello, I am Olivia AI. I can answer your questions and pass your request to the Suites Mine team. Only the hotel can handle and confirm a reservation.",
      actions: [["Contact the hotel", "I would like to send a request to the hotel"], ["Rooms", "What room types do you offer?"], ["Services", "What services do you offer?"], ["My reservation", "I need help with an existing reservation"]],
      error: "Olivia could not answer. Please try again or contact contacto@suitesmine.com / +52 55 3666 8535.",
      review: "Review your request for the hotel", fullName: "Full name", email: "Email",
      phone: "Phone (optional)", request: "Your request", submit: "Send my request to the hotel",
      notice: "Your details and request will be sent to the Suites Mine team. This does not create, change or confirm a reservation.",
      sent: "Your request has been submitted through the Suites Mine contact form. The hotel must reply and confirm any reservation action.",
      sendError: "Your request could not be submitted. Sending has not been confirmed. Please try again or email contacto@suitesmine.com.",
      typing: "Olivia is typing",
    },
    zh: {
      name: "Olivia AI 礼宾", open: "打开 Olivia AI", close: "关闭 Olivia AI",
      placeholder: "请输入您的问题...", send: "发送",
      welcome: "您好，我是 Olivia AI。我可以回答您的问题，并将您的需求转交给 Suites Mine 团队。只有酒店可以处理和确认预订。",
      actions: [["联系酒店", "我想向酒店发送请求"], ["客房", "有哪些房型？"], ["服务", "提供哪些服务？"], ["我的预订", "我需要有关现有预订的帮助"]],
      error: "Olivia 暂时无法回复，请重试或联系 contacto@suitesmine.com / +52 55 3666 8535。",
      review: "请核对您的酒店请求", fullName: "姓名", email: "电子邮件", phone: "电话（可选）",
      request: "您的请求", submit: "将我的请求发送给酒店",
      notice: "您的联系方式和请求将发送给 Suites Mine 团队。这不会创建、更改或确认预订。",
      sent: "您的请求已通过 Suites Mine 联系表单提交。任何预订操作均需酒店回复并确认。",
      sendError: "未能提交您的请求，发送尚未确认。请重试或发送邮件至 contacto@suitesmine.com。",
      typing: "Olivia 正在输入",
    },
  }[language] || null;
  if (!copy) return;

  const launcher = widget.querySelector(".olivia-launcher");
  const panel = widget.querySelector(".olivia-panel");
  const close = widget.querySelector(".olivia-close");
  const form = widget.querySelector(".olivia-form");
  const messages = widget.querySelector(".olivia-messages");
  const input = form.querySelector('[name="message"]');
  const submit = form.querySelector('[type="submit"]');
  const history = [];
  const operatorMessages = new Set();
  let lead = {};
  let requestSummary = "";
  let requestStatus = "";
  let busy = false;
  let identity = null;
  let identityExpiresAt = 0;
  let identityPending = null;
  let visitorId;
  try {
    visitorId = localStorage.getItem("oliviaVisitorId") || crypto.randomUUID();
    localStorage.setItem("oliviaVisitorId", visitorId);
  } catch {
    visitorId = crypto.randomUUID();
  }

  launcher.setAttribute("aria-label", copy.open);
  close.setAttribute("aria-label", copy.close);
  panel.setAttribute("aria-label", copy.name);
  widget.querySelector(".olivia-launcher__text").textContent = copy.name;
  widget.querySelector(".olivia-header h2").textContent = copy.name;
  widget.querySelector(".olivia-message--assistant").textContent = copy.welcome;
  input.placeholder = copy.placeholder;
  submit.textContent = copy.send;
  const actions = widget.querySelector("[data-olivia-actions]");
  for (const [label, prompt] of copy.actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "olivia-action";
    button.textContent = label;
    button.addEventListener("click", () => {
      if (prompt === copy.actions[0][1] && !busy) {
        requestStatus = "";
        requestSummary = "";
      }
      sendMessage(prompt);
    });
    actions.append(button);
  }
  launcher.addEventListener("click", () => {
    panel.hidden = false;
    launcher.hidden = true;
    input.focus();
  });
  close.addEventListener("click", () => {
    panel.hidden = true;
    launcher.hidden = false;
    launcher.focus();
  });

  function addMessage(text, role) {
    const node = document.createElement("div");
    node.className = `olivia-message olivia-message--${role}`;
    node.textContent = text;
    messages.append(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  async function getIdentity() {
    if (identity && Date.now() < identityExpiresAt) return identity;
    if (!identityPending) {
      identityPending = (async () => {
        const response = await fetch(identityEndpoint, { signal: AbortSignal.timeout(15000) });
        const data = await response.json();
        if (!response.ok || data.clientCode !== clientCode || !data.identity) throw new Error("Olivia identity unavailable");
        identity = data.identity;
        identityExpiresAt = Date.now() + 50 * 60 * 1000;
        return identity;
      })().finally(() => { identityPending = null; });
    }
    return identityPending;
  }

  async function api(url, method = "GET", payload) {
    const token = await getIdentity();
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "X-Olivia-Widget-Identity": token },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) identity = null;
      throw new Error(data.error || "Olivia request failed");
    }
    return data;
  }

  function metadata() {
    return { page: location.pathname, lead, hotelRequestSummary: requestSummary, hotelRequestStatus: requestStatus };
  }

  function persistAssistant(content, model) {
    return api(inboxEndpoint, "PATCH", { clientCode, visitorId, content, model, metadata: metadata() });
  }

  function reviewRequest() {
    const current = messages.querySelector(".olivia-request-form");
    // Preserve edits while a request is being transmitted.
    if (current?.dataset.sending === "true") return;
    current?.remove();
    if (requestStatus === "sent") return;
    const review = document.createElement("form");
    review.className = "olivia-request-form";
    review.setAttribute("aria-label", copy.review);
    const title = document.createElement("strong");
    title.textContent = copy.review;
    review.append(title);
    for (const [key, label, type, required] of [
      ["name", copy.fullName, "text", true], ["email", copy.email, "email", true],
      ["phone", copy.phone, "tel", false], ["message", copy.request, "textarea", true],
    ]) {
      const wrapper = document.createElement("label");
      wrapper.textContent = label;
      const field = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") field.type = type;
      field.name = key;
      field.required = required;
      field.maxLength = type === "textarea" ? 6000 : 320;
      field.value = key === "message" ? requestSummary : lead[key] || "";
      wrapper.append(field);
      review.append(wrapper);
    }
    const notice = document.createElement("p");
    notice.textContent = copy.notice;
    const send = document.createElement("button");
    send.type = "submit";
    send.textContent = copy.submit;
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    review.append(notice, send, status);
    review.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (review.dataset.sending === "true" || !review.reportValidity()) return;
      review.dataset.sending = "true";
      send.disabled = true;
      status.textContent = "";
      const fields = Object.fromEntries(new FormData(review));
      lead = { ...lead, name: fields.name, email: fields.email, phone: fields.phone };
      requestSummary = fields.message;
      try {
        const response = await fetch(widget.dataset.contactEndpoint, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: fields.name, email: fields.email, phone: fields.phone,
            _subject: "Olivia AI — Solicitud de contacto Suites Mine (no es una reserva)",
            message: `${fields.message}\n\nSolicitud de contacto enviada por el visitante desde Olivia AI. No crea ni confirma ninguna reserva.\n\nConversación: ${visitorId}\nPágina: ${location.href}`,
          }),
          signal: AbortSignal.timeout(30000),
        });
        const result = await response.json();
        if (!response.ok || result.ok !== true) throw new Error("Contact form did not accept request");
        requestStatus = "sent";
        review.remove();
        addMessage(copy.sent, "assistant");
        history.push({ role: "assistant", content: copy.sent });
        await persistAssistant(copy.sent).catch(() => {});
      } catch {
        status.textContent = copy.sendError;
      } finally {
        review.dataset.sending = "false";
        send.disabled = false;
      }
    });
    messages.append(review);
    messages.scrollTop = messages.scrollHeight;
  }

  const ready = (async () => {
    try {
      const params = new URLSearchParams({ clientCode, visitorId });
      const data = await api(`${inboxEndpoint}?${params}`);
      lead = data.metadata?.lead || {};
      requestSummary = data.metadata?.hotelRequestSummary || "";
      requestStatus = data.metadata?.hotelRequestStatus || "";
      for (const message of (data.messages || []).slice(-20)) {
        if (!["visitor", "ai", "operator"].includes(message.role)) continue;
        const role = message.role === "visitor" ? "user" : "assistant";
        addMessage(message.content, role);
        history.push({ role, content: message.content });
        if (message.role === "operator") operatorMessages.add(message.id);
      }
      if (requestSummary && requestStatus !== "sent") reviewRequest();
    } catch {
      // A storage outage must not substitute a scripted response for the AI.
    }
  })();

  async function sendMessage(text) {
    text = String(text || "").trim();
    if (!text || busy) return;
    busy = true;
    submit.disabled = true;
    let typing;
    try {
      await ready;
      addMessage(text, "user");
      input.value = "";
      const inbox = await api(inboxEndpoint, "POST", {
        clientCode, visitorId, content: text, source: "website", language, metadata: metadata(),
      }).catch(() => null);
      if (inbox?.conversation?.status === "manual") return;
      typing = addMessage("…", "assistant");
      typing.setAttribute("aria-label", copy.typing);
      const data = await api(chatEndpoint, "POST", {
        clientCode, visitorId, source: "website", language, pageUrl: location.href,
        message: text, metadata: metadata(), history: history.slice(-18),
      });
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Empty AI answer");
      typing.remove();
      history.push({ role: "user", content: text }, { role: "assistant", content: data.reply });
      lead = { ...lead, ...Object.fromEntries(Object.entries(data.collected || {}).filter(([, value]) => value)) };
      if (data.hotelRequestSummary) requestSummary = data.hotelRequestSummary;
      addMessage(data.reply, "assistant");
      await persistAssistant(data.reply, data.model).catch(() => {});
      if (data.action === "review_hotel_request") reviewRequest();
    } catch {
      typing?.remove();
      addMessage(copy.error, "assistant");
    } finally {
      busy = false;
      submit.disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });
  setInterval(async () => {
    if (panel.hidden || busy) return;
    await ready;
    try {
      const params = new URLSearchParams({ clientCode, visitorId });
      const data = await api(`${inboxEndpoint}?${params}`);
      for (const message of data.messages || []) {
        if (message.role !== "operator" || operatorMessages.has(message.id)) continue;
        operatorMessages.add(message.id);
        addMessage(message.content, "assistant");
        history.push({ role: "assistant", content: message.content });
      }
    } catch {}
  }, 4000);
})();
