const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
const fileCancelButton = document.querySelector("#file-cancel");
const fileUploadButton = document.querySelector("#file-upload");
const chatForm = document.querySelector(".chat-form");

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
];

const userData = {
    message: "",
    file: {
        data: null,
        mime_type: null
    }
};

const conversationHistory = [];
const initialInputHeight = messageInput.scrollHeight;


// Creates and returns a message element.
const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");

    div.classList.add("message", ...classes);
    div.innerHTML = content;

    return div;
};


// Escapes HTML characters before inserting AI-generated content.
const escapeHTML = (text) => {
    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
};


// Converts basic Markdown from Gemini into safe HTML.
const formatBotResponse = (text) => {
    let formattedText = escapeHTML(text.trim());

    // Code blocks
    formattedText = formattedText.replace(
        /```(?:\w+)?\n?([\s\S]*?)```/g,
        "<pre><code>$1</code></pre>"
    );

    // Inline code
    formattedText = formattedText.replace(
        /`([^`\n]+)`/g,
        "<code>$1</code>"
    );

    // Headings
    formattedText = formattedText.replace(
        /^### (.*)$/gm,
        "<h4>$1</h4>"
    );

    formattedText = formattedText.replace(
        /^## (.*)$/gm,
        "<h3>$1</h3>"
    );

    formattedText = formattedText.replace(
        /^# (.*)$/gm,
        "<h2>$1</h2>"
    );

    // Unordered lists
    formattedText = formattedText.replace(
        /((?:^[-*] .*(?:\n|$))+)/gm,
        (list) => {
            const items = list
                .trim()
                .split("\n")
                .map(item => item.replace(/^[-*] /, "").trim())
                .map(item => `<li>${item}</li>`)
                .join("");

            return `<ul>${items}</ul>`;
        }
    );

    // Ordered lists
    formattedText = formattedText.replace(
        /((?:^\d+\. .*(?:\n|$))+)/gm,
        (list) => {
            const items = list
                .trim()
                .split("\n")
                .map(item => item.replace(/^\d+\. /, "").trim())
                .map(item => `<li>${item}</li>`)
                .join("");

            return `<ol>${items}</ol>`;
        }
    );

    // Bold
    formattedText = formattedText.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    // Italic
    formattedText = formattedText.replace(
        /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
        "<em>$1</em>"
    );

    // Convert remaining line breaks.
    formattedText = formattedText.replace(/\n/g, "<br>");

    return `<p>${formattedText}</p>`;
};


// Generates a bot response through our backend.
const generateBotResponse = async (
    incomingMessageDiv,
    message,
    file
) => {
    const messageElement =
        incomingMessageDiv.querySelector(".message-text");

    const requestBody = {
        message,
        file: file.data ? file : null,
        history: conversationHistory
    };

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Failed to generate a response."
            );
        }

        const botResponse = data.response.trim();

        // Render the formatted response.
        messageElement.innerHTML =
            formatBotResponse(botResponse);

        // Build the user's history entry.
        const userParts = [];

        if (message) {
            userParts.push({
                text: message
            });
        }

        if (file.data) {
            userParts.push({
                inlineData: {
                    mimeType: file.mime_type,
                    data: file.data
                }
            });
        }

        conversationHistory.push({
            role: "user",
            parts: userParts
        });

        // Add the bot response to history.
        conversationHistory.push({
            role: "model",
            parts: [
                {
                    text: botResponse
                }
            ]
        });

    } catch (error) {
        console.error("Chat error:", error);

        messageElement.innerText =
            "Sorry, I couldn't generate a response. Please try again.";

    } finally {
        incomingMessageDiv.classList.remove("thinking");

        clearSelectedFile();

        chatBody.scrollTo({
            top: chatBody.scrollHeight,
            behavior: "smooth"
        });
    }
};


// Clears the currently selected file.
const clearSelectedFile = () => {
    userData.file = {
        data: null,
        mime_type: null
    };

    fileUploadWrapper.classList.remove("file-uploaded");
    fileUploadWrapper.querySelector("img").src = "";
    fileInput.value = "";
};


// Handles outgoing user messages.
const handleOutgoingMessage = (event) => {
    event.preventDefault();

    const message = messageInput.value.trim();

    const file = {
        data: userData.file.data,
        mime_type: userData.file.mime_type
    };

    if (!message && !file.data) {
        return;
    }

    messageInput.value = "";
    messageInput.dispatchEvent(new Event("input"));

    // Creates and displays the user's message.
    const messageContent = `
        <div class="message-text"></div>
        ${
            file.data
                ? `<img
                    src="data:${file.mime_type};base64,${file.data}"
                    class="attachment"
                    alt="Attached image"
                >`
                : ""
        }
    `;

    const outgoingMessageDiv = createMessageElement(
        messageContent,
        "user-message"
    );

    outgoingMessageDiv.querySelector(".message-text").textContent =
        message;

    chatBody.appendChild(outgoingMessageDiv);

    chatBody.scrollTo({
        top: chatBody.scrollHeight,
        behavior: "smooth"
    });

    // Creates the bot's thinking message.
    setTimeout(() => {
        const messageContent = `
            <svg
                class="bot-avatar"
                xmlns="http://www.w3.org/2000/svg"
                width="50"
                height="50"
                viewBox="0 0 1024 1024"
            >
                <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9zM351.7 448.2c0-29.5 23.9-53.5 53.5-53.5s53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5-53.5-23.9-53.5-53.5zm157.9 267.1c-67.8 0-123.8-47.5-132.3-109h264.6c-8.6 61.5-64.5 109-132.3 109zm110-213.7c-29.5 0-53.5-23.9-53.5-53.5s23.9-53.5 53.5-53.5 53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5zM867.2 644.5V453.1h26.5c19.4 0 35.1 15.7 35.1 35.1v121.1c0 19.4-15.7 35.1-35.1 35.1h-26.5zM95.2 609.4V488.2c0-19.4 15.7-53.5 53.5-53.5s53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5-53.5-23.9-53.5-53.5zm157.9 267.1c-67.8 0-123.8-47.5-132.3-109h264.6c-8.6 61.5-64.5 109-132.3 109zm110-213.7c-29.5 0-53.5-23.9-53.5-53.5s23.9-53.5 53.5-53.5 53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5zM867.2 644.5V453.1h26.5c19.4 0 35.1 15.7 35.1 35.1v121.1c0 19.4-15.7 35.1-35.1 35.1h-26.5zM95.2 609.4V488.2c0-19.4 15.7-35.1 35.1-35.1h26.5v191.3h-26.5c-19.4 0-35.1-15.7-35.1-35.1zM561.5 149.6c0 23.4-15.6 43.3-36.9 49.7v44.9h-30v-44.9c-21.4-6.5-36.9-26.3-36.9-49.7 0-28.6 23.3-51.9 51.9-51.9s51.9 23.3 51.9 51.9z"></path>
            </svg>

            <div class="message-text">
                <div class="thinking-indicator">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        `;

        const incomingMessageDiv = createMessageElement(
            messageContent,
            "bot-message",
            "thinking"
        );

        chatBody.appendChild(incomingMessageDiv);

        chatBody.scrollTo({
            top: chatBody.scrollHeight,
            behavior: "smooth"
        });

        generateBotResponse(
            incomingMessageDiv,
            message,
            file
        );
    }, 600);
};


// Handles Enter on desktop.
messageInput.addEventListener("keydown", (event) => {
    if (
        event.key === "Enter" &&
        !event.shiftKey &&
        window.innerWidth > 768
    ) {
        event.preventDefault();
        chatForm.requestSubmit();
    }
});


// Handles form submission.
chatForm.addEventListener(
    "submit",
    handleOutgoingMessage
);


// Dynamically adjusts the textarea height.
messageInput.addEventListener("input", () => {
    messageInput.style.height =
        `${initialInputHeight}px`;

    messageInput.style.height =
        `${messageInput.scrollHeight}px`;

    chatForm.style.borderRadius =
        messageInput.scrollHeight > initialInputHeight
            ? "15px"
            : "32px";
});


// Handles file selection.
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    if (!file) {
        return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        alert(
            "Unsupported file type. Please select a JPG, PNG, WEBP, or GIF image."
        );

        clearSelectedFile();
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        alert(
            "Image is too large. Please select an image smaller than 5 MB."
        );

        clearSelectedFile();
        return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
        fileUploadWrapper.querySelector("img").src =
            event.target.result;

        fileUploadWrapper.classList.add("file-uploaded");

        const base64String =
            event.target.result.split(",")[1];

        userData.file = {
            data: base64String,
            mime_type: file.type
        };
    };

    reader.readAsDataURL(file);
});


// Cancels the selected file.
fileCancelButton.addEventListener(
    "click",
    clearSelectedFile
);


// Initializes the emoji picker.
const picker = new EmojiMart.Picker({
    theme: "light",
    skinTonePosition: "none",
    previewPosition: "none",

    onEmojiSelect: (emoji) => {
        const {
            selectionStart: start,
            selectionEnd: end
        } = messageInput;

        messageInput.setRangeText(
            emoji.native,
            start,
            end,
            "end"
        );

        messageInput.focus();
    },

    onClickOutside: (event) => {
        if (event.target.closest("#emoji-picker")) {
            document.body.classList.toggle(
                "show-emoji-picker"
            );
        } else {
            document.body.classList.remove(
                "show-emoji-picker"
            );
        }
    }
});


chatForm.appendChild(picker);


// Opens the file selector.
fileUploadButton.addEventListener(
    "click",
    () => fileInput.click()
);