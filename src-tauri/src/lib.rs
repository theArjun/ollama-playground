// 🦙 Ollama client imports for chat functionality
use ollama_rs::generation::chat::request::ChatMessageRequest;
use ollama_rs::generation::chat::ChatMessage;
use ollama_rs::Ollama;
// 📦 Serialization tools for data exchange
use serde::{Deserialize, Serialize};
// 🌉 Tauri framework imports for IPC and state management
use tauri::ipc::Channel;
use tauri::State;
// 🔒 Async synchronization primitives
use tokio::sync::Mutex;
// 🌊 Stream processing utilities
use futures_util::StreamExt;

// 🏠 Application state container - holds our Ollama client
struct AppState {
    ollama: Mutex<Ollama>, // 🔐 Thread-safe Ollama client wrapper
}

// 💬 Chat request structure from frontend
// Deserialization is important here, since it is required as input in chat command.
#[derive(Serialize, Deserialize)]
struct ChatRequest {
    model: String,              // 🤖 AI model name (e.g., "llama2", "mistral")
    messages: Vec<ChatMessage>, // 📝 Conversation history
}

// 📤 Response structure sent back to frontend
#[derive(Serialize)]
struct ChatResponse {
    message: String, // 💭 AI-generated response content
}

// 📋 Command to fetch available local models
#[tauri::command]
async fn get_models(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let models = {
        // 🔓 Acquire lock on Ollama client
        let client = state.ollama.lock().await;
        // 🔍 Query local models from Ollama
        client
            .list_local_models()
            .await
            .map_err(|e| format!("Failed to list models: {:?}", e))?
    }; // 🔒 Lock automatically released here

    // 🏷️ Extract just the model names from the full model objects
    let model_names = models
        .iter()
        .map(|local_model| local_model.name.clone())
        .collect();

    Ok(model_names)
}

// 🚀 Main chat command - handles streaming AI responses
#[tauri::command]
async fn chat_to_llm(
    request: ChatRequest,             // 📥 Incoming chat request
    on_stream: Channel<ChatResponse>, // 📡 Streaming channel to frontend
    state: State<'_, AppState>,       // 🏠 Application state
) -> Result<(), String> {
    // 🔓 Get exclusive access to Ollama client
    let client = state.ollama.lock().await;
    // 🛠️ Build chat request for Ollama API
    let chat_request = ChatMessageRequest::new(request.model, request.messages);

    // 🌊 Initialize streaming response from Ollama
    let mut stream = client
        .send_chat_messages_stream(chat_request)
        .await
        .map_err(|e| format!("{:?}", e))?;

    // 🔄 Process each chunk of the streaming response
    // to run next() method, it requires StreamExt;
    while let Some(stream_response) = stream.next().await {
        // ⚠️ Handle potential stream errors
        let response = stream_response.map_err(|e| format!("Stream error {:?}", e))?;
        // 📦 Package response for frontend
        let chat_response = ChatResponse {
            message: response.message.content,
        };

        // 📤 Send response chunk to frontend via IPC channel
        on_stream.send(chat_response).map_err(|e| e.to_string())?;
    }

    Ok(()) // ✅ Stream completed successfully
}

// 🚀 Application entry point
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init()) // 🔌 Enable file/URL opening capabilities
        .manage(AppState {
            // 🏗️ Initialize application state
            ollama: Mutex::new(Ollama::default()), // 🦙 Create default Ollama client
        })
        .invoke_handler(tauri::generate_handler![get_models, chat_to_llm]) // 🎯 Register command handlers
        .run(tauri::generate_context!()) // 🏃 Start the application
        .expect("error while running tauri application"); // 💥 Panic on startup failure
}
