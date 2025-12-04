function scriptInjection() {
  const WPP = document.createElement("script");
  WPP.src = chrome.runtime.getURL("js/WPP.js");
  document.documentElement.appendChild(WPP);
  document.documentElement.removeChild(WPP);

  const injection = document.createElement("script");
  injection.src = chrome.runtime.getURL("js/injection.js");
  document.documentElement.appendChild(injection);
  document.documentElement.removeChild(injection);

  localStorage.setItem("BotIniciado", false);
}

scriptInjection();
//console.log("Injected");
/*
      ---schema---
      Receive message from the Injection -> ContentScript send request From API -> verify if has url to handle the base64 to the background
      background sent back the message -> send the response to the Injection -> Injection Release and send the message using FMARK to the chat
      
      obs: I hate manifest V3 :thumbsUp:
      */
var botIniciado = false;
var firstTimeSending = true;
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "reloadAfterActivation") {
    location.reload();
    return;
  }
  if (request.action === "getBotInitialization") {
    sendResponse({
      success: true,
      bot: JSON.parse(localStorage.getItem("BotIniciado")),
    });
    return;
  }

  if (request.action === "clearNumbers") {
    activeSessions = {};
    endChatNumbers = [];
    return;
  }

  if (request.action === "toggleBot") {
    if (firstTimeSending && request.freeVersion) {
      createMessagePanel(
        "Você está usando a versão Free! Lembre-se que essa versão envia apenas textos e não tem delay. Para liberar todo o poder do TypeBot, adquira uma licença premium."
      );
      firstTimeSending = false;
      isFree = true;
      setVariableEvery10Seconds();
    }
    botIniciado = !botIniciado;
    stopChatAfterEnding = request.stopChatAfterEnding;
    if (fixedUrlAPIChanged !== request.urlAPI) {
      activeSessions = {};
      endChatNumbers = [];
    }
    fixedUrlAPIChanged = request.urlAPI;
    legacyUrlAPI = request.urlAPI;
    urlAPI = request.urlAPI;
    endChatAfterSeconds = request.endChatAfterSeconds || 0;
    const messageData = {
      type: "START_CONFIGURATION",
      activeDelay: request.activeDelay || false,
      delayTyping: request.delayPerText || 5,
      delayMessage: request.delayPerMessage || 2,
      delayRecording: request.delayPerAudio || 5,
      linkRedirect: request.linkRedirect || "",
      changePollToList: request.changePollToList || false,
    };
    window.postMessage(messageData, "*");
    sendResponse({ success: true, botActive: botIniciado });
    determineAPIType();
  }
  if (request.action === "fmarkInjection") {
    const messageData = {
      type: "FMARK_INJECTION",
      FMARK: request.FMARK || "",
      free: request.free,
    };
    if (request.key) {
      localStorage.setItem("02b918b8b73d1626c8266569429e2252", request.key);
    }
    window.postMessage(messageData, "*");
  }
});

//sessions

let activeSessions = {};
let endChatNumbers = [];
const processingFlags = {};
let endChatAfterSeconds = 10;
let stopChatAfterEnding = false;

//API url

let fixedUrlAPIChanged = "";

let legacyAPI = true;

let legacyUrlAPI = ""; //https://bot-view.typebotfull.com/danilo-teste-h53g00h
let legacyUrl = "";
let LegacyTypeBotId = "";

//NewAPI Url handler
let urlAPI = ""; //https://typebot.co/danilo-teste-393em1w
let urlStart = "";
let urlContinueChat = "";

const getKey = (numberId) => numberId.replace(/[^a-zA-Z0-9]/g, "_");

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;

  const { type, text } = event.data;

  if (type === "e954f3fa07129c0584e6ac1d0f8138f2") {
    verify();
    return;
  }
  if (type === "CLEAR_NUMBERS") {
    activeSessions = {};
    endChatNumbers = [];
    return;
  }

  if(type === "RETURN_COMMAND_STRING"){
    console.log(text);
    //actionSessionVerify();
  }

  if (type === "RELEASE_KEY") {
    processingFlags[event.data.key] = false;
    return;
  }

  if (type === "TYPE_BOT" || type === "POLL_BOT") {
    const jsonData = JSON.parse(text);
    const numberId = type === "TYPE_BOT" ? jsonData.id.remote : jsonData.sender;
    const key = getKey(numberId);
    if (endChatNumbers.includes(numberId) || processingFlags[key]) return;

    const handleSession = async () => {
      try
      {
        const sessionId = activeSessions[key];
        const message = getMessage(type, jsonData);

        processingFlags[key] = true;
        if (!sessionId) {
          await startSession(sessionId, message, numberId, key, type);
        } else {
          await continueSession(sessionId, message, numberId, key, type);
        }

      } catch (error) {
        console.error("Erro no handleSession:", error);
        // Aqui você pode adicionar qualquer ação adicional para lidar com o erro,
        // como enviar uma mensagem de erro para o usuário ou registrar o erro em algum sistema de monitoramento.
      } finally {
        processingFlags[key] = false;
      }
    };

    setTimeout(handleSession, 100);
  }
});

async function startSession(sessionId, message, numberId, key, type) {
  const startMessageResult = await getStartMessageResult(type);
  activeSessions[key] = startMessageResult.sessionId;
  const messagesWithBase64 = await replaceUrlsWithBase64(
    startMessageResult.messages.map(formatMessage)
  );
  if (
    Array.isArray(startMessageResult.clientSideActions) &&
    (setVariableAction = startMessageResult.clientSideActions.find(action => action.type === 'setVariable'))
  ) {
    if (setVariableAction) {
      const scriptContent = setVariableAction?.setVariable?.scriptToExecute?.content;
      var data = {
        type:"INJECT_COMMAND_STRING",
        command: scriptContent,
        startMessageResult,
        messagesWithBase64,
        numberId,
        key,
        type,
        message
      }
      window.postMessage(data, "*");
    } else {
      console.log('No action with type "setVariable" found.');
    }
  }else{
    let setDelayAction = startMessageResult?.clientSideActions && Array.isArray(startMessageResult.clientSideActions) && startMessageResult.clientSideActions.find(action => action.type === 'wait')
    if(setDelayAction && startMessageResult.messages.length == 0){
      await delay(setDelayAction.wait.secondsToWaitFor*1000);
    }
    actionSessionVerify(startMessageResult,
      messagesWithBase64,
      numberId,
      key,
      type,
      message);
  }
  
}

async function actionSessionVerify(
  startMessageResult,
  messagesWithBase64,
  numberId,
  key,
  type,
  message
){
  if (startMessageResult.input) {
    handleInput(startMessageResult, messagesWithBase64, numberId, key, type, message);
  } else {
    if (messagesWithBase64.length === 0) {
      await continueSession(startMessageResult.sessionId, message, numberId, key, type);
      return;
    }
    sendMessage("MESSAGE", messagesWithBase64, numberId, key);
    endChatNumbers.push(numberId);
    removeNumberAfterDelay(numberId, key);
  }
}

async function continueSession(sessionId, message, numberId, key, type) {
  const sendMessageResult = await getSendMessageResult(
    type,
    sessionId,
    message
  );
  console.log(sendMessageResult);
  const messagesWithBase64 = await replaceUrlsWithBase64(
    sendMessageResult.messages.map(formatMessage)
  );
  if (sendMessageResult.input) {
    handleInput(sendMessageResult, messagesWithBase64, numberId, key, type, message);
  } else {
    sendMessage("MESSAGE", messagesWithBase64, numberId, key);
    endChatNumbers.push(numberId);
    removeNumberAfterDelay(numberId, key);
  }
}

// Helper functions

function getMessage(type, jsonData) {
  return type === "TYPE_BOT"
    ? jsonData.body.replace(/‎$/, "")
    : jsonData.selectedOptions
        .find((option) => option !== null)
        .name.replace(/‎$/, "");
}

function formatMessage(message) {
  console.log(message);
  if (message.type === "text" && message.content && message.content.richText) {
    const redirectUrl =
      message.redirect && message.redirect.url ? message.redirect.url : "";
    return {
      type: "text",
      wait: message.secondsToWaitFor || 0,
      text: formatRichText(message.content.richText),
      redirect: redirectUrl,
    };
  } else if (message.content && message.content.url) {
    const redirectUrl =
      message.redirect && message.redirect.url ? message.redirect.url : "";
    const clickLink =
      message.content.clickLink && message.content.clickLink.url
        ? message.content.clickLink.url
        : "";
    return {
      type: "embed",
      wait: message.secondsToWaitFor || 0,
      url: message.content.url,
      redirect: redirectUrl,
      clickLink: clickLink,
    };
  }
  return { type: "redirect", redirect: message.redirect.url };
}

function formatRichText(richText) {
  let formattedText = "";

  richText.forEach((element, index) => {
    const formattedElement = formatElement(element);
    formattedText += formattedElement;

    // Add a newline after all paragraphs except the last one
    if (element.type === "p" && index < richText.length - 1) {
      formattedText += "\n";
    }
  });

  return formattedText;
}

function formatElement(element) {
  switch (element.type) {
    case "p":
      return formatRichText(element.children);
    case "inline-variable":
    case "variable":
      return formatRichText(element.children);
    case "a":
      const linkText = formatRichText(element.children);
      return element.url ? `[${linkText}](${element.url})` : linkText;
    default:
      let text = element.text || "";
      if (element.bold) text = `*${text}*`;
      if (element.italic) text = `_${text}_`;
      if (element.underline) text = `~${text}~`;
      return text;
  }
}

async function handleInput(input, messagesWithBase64, numberId, key, type, message) {
  if (input.input.items && input.input.items.length > 0) {
    if (input.input.items.length === 1) {
      const duplicatedItem = { ...input.input.items[0] };
      if (duplicatedItem.content) {
        duplicatedItem.content += "‎";
      }
      input.input.items.push(duplicatedItem);
    }

    const itemsContent = input.input.items
      .filter((item) => item.content)
      .map((item) => item.content);

    if (itemsContent.length > 0) {
      sendMessage(
        "MESSAGE",
        messagesWithBase64,
        numberId,
        key,
        itemsContent,
        messagesWithBase64[messagesWithBase64.length - 1],
        true
      );
    }
  } else {
    if (messagesWithBase64.length === 0) {
      await continueSession(input.sessionId, message, numberId, key, type);
      return;
    }
    sendMessage("MESSAGE", messagesWithBase64, numberId, key);
    //endChatNumbers.push(numberId);
  }
}

async function getStartMessageResult(type) {
  return addSecondsToWaitFor(
    JSON.parse(
      JSON.stringify(
        await (legacyAPI
          ? legacyStartMessageToTypeBot()
          : startMessageToTypeBot())
      )
    )
  );
}

async function getSendMessageResult(type, sessionId, message) {
  return addSecondsToWaitFor(
    JSON.parse(
      JSON.stringify(
        await (legacyAPI
          ? legacySendMessageToTypeBot(sessionId, message)
          : sendMessageToTypeBot(sessionId, message))
      )
    )
  );
}

function sendMessage(
  messageType,
  messagesWithBase64,
  numberId,
  key,
  inputs,
  title,
  poll
) {
  const messageObject = {
    type: messageType,
    texts: messagesWithBase64,
    number: numberId,
    key: key,
  };

  if (inputs) {
    messageObject.inputs = inputs;
  }

  if (title) {
    messageObject.title = title;
  }

  if (poll) {
    messageObject.poll = true;
  }

  window.postMessage(messageObject, "*");
}

async function legacyStartMessageToTypeBot() {
  let lastSlashIndex = legacyUrlAPI.lastIndexOf("/");
  legacyUrl = `${legacyUrlAPI.slice(0, lastSlashIndex)}/api/v1/sendMessage`;
  LegacyTypeBotId = legacyUrlAPI.slice(lastSlashIndex + 1);
  await delay(25);
  const body = {
    startParams: {
      typebot: LegacyTypeBotId,
    },
  };

  try {
    const response = await fetch(legacyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

async function legacySendMessageToTypeBot(sessionId, message) {
  const body = {
    message,
    sessionId,
  };
  try {
    const response = await fetch(legacyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    await delay(50);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

async function sendMessageToTypeBot(sessionId, message) {
  let lastSlashIndex = urlAPI.lastIndexOf("/");
  let firstPart = urlAPI.slice(0, lastSlashIndex);
  urlContinueChat = `${firstPart}/api/v1/sessions/${sessionId}/continueChat`;
  console.log(urlContinueChat)
  await delay(50);
  const body = {
    message,
  };

  console.log(body)

  try {
    const response = await fetch(urlContinueChat, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

async function startMessageToTypeBot() {
  let lastSlashIndex = urlAPI.lastIndexOf("/");
  let firstPart = urlAPI.slice(0, lastSlashIndex);
  let lastPart = urlAPI.slice(lastSlashIndex + 1);
  urlStart = `${firstPart}/api/v1/typebots/${lastPart}/startChat`;
  await delay(25);
  const body = {
    isStreamEnabled: true,
    prefilledVariables: {},
  };

  try {
    const response = await fetch(urlStart, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

function connectToBackground() {
  return chrome.runtime.connect({ name: "content-script" });
}

var port = connectToBackground(); // Port Connection

function sendMessageToBackground(message, callback) {
  if (!port.sender || !port.sender.tab) {
    // If the port is not connected, create a new one
    port = connectToBackground();
  }

  var messageId = Math.random().toString(36).substring(7);

  port.postMessage({ message: message, callbackId: messageId });

  port.onMessage.addListener(function (response) {
    if (response.callbackId === messageId) {
      callback(response.data);
    }
  });
}

async function replaceUrlsWithBase64(messages) {
  var updatedMessages = [];

  for (const message of messages) {
    if (message.type === "embed" && message.url) {
      // Check if the URL starts with "https://" or "http://"
      const isHttpOrHttps = /^https?:\/\//i.test(message.url);
      const formattedUrl = isHttpOrHttps
        ? message.url
        : `https://${message.url}`;

      try {
        // Send a message to the background script to download and convert the file
        let result = await new Promise((resolve) => {
          sendMessageToBackground(
            { type: "downloadAndConvert", url: formattedUrl },
            resolve
          );
        });

        if (result.mimeType.includes("html")) {
          updatedMessages.push({
            type: "redirect",
            wait: message.wait || 0,
            redirect: {
              url: formattedUrl,
            },
          });
          continue;
        }

        var formattedUrlClickLink = "";
        if (message.clickLink) {
          const isHttpOrHttpsClickLink = /^https?:\/\//i.test(
            message.clickLink
          );
          formattedUrlClickLink = isHttpOrHttpsClickLink
            ? message.clickLink
            : `https://${message.clickLink}`;
        }
        updatedMessages.push({
          type: "embed",
          wait: message.wait || 0,
          url: result.base64data,
          mime: result.mimeType,
          clickLink: formattedUrlClickLink,
        });
      } catch (error) {
        console.error(`Failed to download and convert file: ${error.message}`);
      }
    } else {
      updatedMessages.push(message);
    }
  }

  return updatedMessages;
}

const formatText = (richText) => {
  return richText
    .map((element) => {
      let formattedText = element.text;

      if (element.bold) {
        formattedText = `*${formattedText}*`;
      }

      if (element.italic) {
        formattedText = `_${formattedText}_`;
      }

      if (element.underline) {
        formattedText = `~${formattedText}~`;
      }

      return formattedText;
    })
    .join("");
};

function addSecondsToWaitFor(json) {
  if (json.messages && json.messages.length > 0) {
    const orderedMessages = json.messages.map((message) => ({ ...message }));

    if (json.clientSideActions) {
      json.clientSideActions.forEach((action) => {
        const targetMessage = orderedMessages.find(
          (message) => message.id === action.lastBubbleBlockId
        );

        if (targetMessage) {
          if (action.redirect) {
            targetMessage.redirect = action.redirect;
          }
          if (action.wait && action.wait.secondsToWaitFor) {
            targetMessage.secondsToWaitFor = action.wait.secondsToWaitFor;
          }
        }
      });
    }

    json.messages = orderedMessages;
  } else {
    if (json.clientSideActions && json.clientSideActions.length > 0) {
      if (
        json.clientSideActions[0].redirect &&
        json.clientSideActions[0].redirect.url
      ) {
        json.messages = [
          {
            type: "redirect",
            redirect: {
              url: json.clientSideActions[0].redirect.url,
            },
          },
        ];
      }
    }
  }
  return json;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeNumberAfterDelay(numberId, key) {
  if (stopChatAfterEnding) {
    return;
  }
  const index = endChatNumbers.indexOf(numberId);
  if (endChatAfterSeconds > 0) {
    setTimeout(() => {
      if (index !== -1) {
        endChatNumbers.splice(index, 1);
      }

      if (activeSessions[key]) {
        delete activeSessions[key];
      }
    }, endChatAfterSeconds * 1000);
    return;
  }

  if (index !== -1) {
    endChatNumbers.splice(index, 1);
  }

  if (activeSessions[key]) {
    delete activeSessions[key];
  }
}

async function determineAPIType() {
  if (botIniciado) {
    const newAPICheck = await determineMessageToTypeBot();
    console.log(newAPICheck);
    newAPICheck ? (legacyAPI = false) : (legacyAPI = true);
  }
}

async function verify() {
  let result = await new Promise((resolve) => {
    sendMessageToBackground(
      {
        type: "e954f3fa07129c0584e6ac1d0f8138f2",
        url: "e8418d1d706cd73548f9f16f1d55ad6e",
        key: localStorage.getItem("02b918b8b73d1626c8266569429e2252"),
      },
      resolve
    );
  });

  if (result) {
    return;
  }
  location.reload();
}

async function determineMessageToTypeBot() {
  try {
    let lastSlashIndex = urlAPI.lastIndexOf("/");
    let firstPart = urlAPI.slice(0, lastSlashIndex);
    let lastPart = urlAPI.slice(lastSlashIndex + 1);
    urlStart = `${firstPart}/api/v1/typebots/${lastPart}/startChat`;
    await delay(25);
    const body = {
      isStreamEnabled: true,
      prefilledVariables: {},
    };
    const response = await fetch(urlStart, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return false;
    }
    // const data = await response.json();
    return true;
  } catch (error) {
    // Handle any errors that occur during the fetch
    console.error("Error during fetch:", error);
    return false;
  }
}

function setVariableEvery10Seconds() {
  isFree = true;
  setTimeout(setVariableEvery10Seconds, 10000);
}

function createMessagePanel(message) {
  const messagePanel = document.createElement("div");
  messagePanel.innerHTML = `
        <div id="messagePanel">
          <button type="button" id="closeButton" class="closeButton">X</button>
          <br>
          <p>${message}</p>
        </div>
        `;

  document.body.appendChild(messagePanel);

  const closeButton = document.getElementById("closeButton");
  closeButton.addEventListener("click", function () {
    messagePanel.style.display = "none";
  });
}
