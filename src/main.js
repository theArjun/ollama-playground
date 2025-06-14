const { invoke } = window.__TAURI__.core;

let messageInput;
let chatMessages;
let chatForm;
let sendButton;
let modelSelect;

// Auto-resize textarea
function autoResize(textarea) {
	textarea.style.height = "auto";
	const maxHeight = 120;
	const newHeight = Math.min(textarea.scrollHeight, maxHeight);
	textarea.style.height = newHeight + "px";
}

async function fetchModels() {
	const fetchedModels = await invoke("get_models");
	return fetchedModels;
}

// Add message to chat
function addMessage(content, isUser = false) {
	const messageDiv = document.createElement("div");
	messageDiv.className = "flex items-start space-x-3";

	if (isUser) {
		messageDiv.className += " flex-row-reverse space-x-reverse";
	}

	const now = new Date();
	const timeString = now.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});

	messageDiv.innerHTML = `
    <div class="flex-shrink-0">
      <div class="w-8 h-8 rounded-full ${isUser ? "bg-emerald-600" : "bg-amber-600"} flex items-center justify-center">
        ${
					isUser
						? '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>'
						: '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>'
				}
      </div>
    </div>
    <div class="flex-1 ${isUser ? "text-right" : ""}">
      <div class="inline-block ${isUser ? "bg-emerald-600 text-white" : "bg-amber-50"} rounded-lg px-4 py-3 max-w-xs lg:max-w-md">
        <p class="${isUser ? "text-white" : "text-amber-900"} leading-relaxed">${content}</p>
      </div>
      <span class="text-xs text-amber-600 mt-1 block">${timeString}</span>
    </div>
  `;

	chatMessages.appendChild(messageDiv);
	chatMessages.scrollTop = chatMessages.scrollHeight;

	return messageDiv;
}

// Static AI responses - book and literature themed
function getStaticResponse(userMessage) {
	const responses = ["Static reply from AI"];

	return responses[0];
}

// Handle form submission
async function handleSubmit(e) {
	e.preventDefault();

	const message = messageInput.value.trim();
	if (!message) return;

	// Disable send button and input
	sendButton.disabled = true;
	messageInput.disabled = true;

	// Get selected model
	const selectedModel = modelSelect.value;

	// Add user message
	addMessage(message, true);

	// Clear input and reset height
	messageInput.value = "";
	messageInput.style.height = "auto";

	// Brief delay for better UX
	setTimeout(() => {
		try {
			// Try to call Tauri backend if available
			invoke("chat_with_ai", { message: message, model: selectedModel })
				.then((response) => {
					addMessage(response, false);
				})
				.catch((error) => {
					// Fallback to static response if Tauri command is not available
					console.log("Tauri backend not available, using static response");
					const staticResponse = getStaticResponse(message);
					addMessage(`[${selectedModel}] ${staticResponse}`, false);
				});
		} catch (error) {
			// Fallback to static response
			const staticResponse = getStaticResponse(message);
			addMessage(`[${selectedModel}] ${staticResponse}`, false);
		}

		// Re-enable send button and input
		sendButton.disabled = false;
		messageInput.disabled = false;
		messageInput.focus();
	}, 500); // Small delay to make interaction feel natural
}

// Initialize app
window.addEventListener("DOMContentLoaded", async () => {
	// Get DOM elements
	messageInput = document.querySelector("#message-input");
	chatMessages = document.querySelector("#chat-messages");
	chatForm = document.querySelector("#chat-form");
	sendButton = document.querySelector("#send-button");
	modelSelect = document.querySelector("#model-select");

	// Populate the model select options from the window.MODEL_LIST
	let models = await fetchModels();
	// If models are empty, add an alert to the user and exit
	if (models.length === 0) {
		alert("No models found. Please check your Ollama installation.");
		return;
	}

	models.forEach((model) => {
		const option = document.createElement("option");
		option.value = model;
		option.textContent = model;
		modelSelect.appendChild(option);
	});

	// Event listeners
	chatForm.addEventListener("submit", handleSubmit);

	// Auto-resize textarea
	messageInput.addEventListener("input", (e) => {
		autoResize(e.target);
	});

	// Handle Enter key (Shift+Enter for new line, Enter to send)
	messageInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	});

	// Focus on input
	messageInput.focus();
});
