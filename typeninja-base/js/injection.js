var isInjected = false;
var fmarkInjected = false;
var isFree = true;

const waitTillDivExists = (divId) => {
  return new Promise((resolve) => {
    const checkForDiv = () => {
      const divElement = document.querySelector(divId);
      if (divElement) {
        resolve();
      } else {
        setTimeout(checkForDiv, 5000);
      }
    };
    checkForDiv();
  });
};

function e8418d1d706cd73548f9f16f1d55ad6e(FMARK2, freekey) {
  if (fmarkInjected) {
    return;
  }
  fmarkInjected = true;
  waitTillDivExists('img[src*="cdn.whatsapp.net"]').then(() => {
    if (
      typeof freekey !== "undefined" &&
      freekey !== null &&
      freekey === false
    ) {
      e954f3fa07129c0584e6ac1d0f8138f2();
    }
    delay(2000);
    if (typeof FMARK !== "undefined") {
      Store.Msg.off("add");
      isFree = false;
    } else {
      isFree = true;
    }
    delay(1000);
    injectWPP();
    delay(1000);
    isInjected = true;
  });
}

// function injectFMARK(FMARK) {
//   if (fmarkInjected) {
//     return;
//   }
//   fmarkInjected = true;
//   waitTillDivExists(
//     'img[src*="whatsapp.net"]'
//   ).then(() => {
//     const executeCode = new Function(FMARK);
//     executeCode();
//     delay(1000);
//     FMARK ? Store.Msg.off("add") : isFree = true;
//     delay(1000);
//     injectWPP();
//     delay(1000);
//     isInjected = true;
//   });
// }

var botIniciado = false;
var textDelay = 5;
var audioDelay = 10;
var delayPerMessage = 2;
var activeDelayMessage = false;
var allAudioDelay = false;
var linkRedirect = "";
var changePollToList = false;

function iniciarBot() {
  var bot = JSON.parse(localStorage.getItem("BotIniciado"));
  bot = !bot;
  localStorage.setItem("BotIniciado", bot);
  if (bot != null) {
    botIniciado = bot;
  }
  console.log("Bot state: " + bot);
}

window.addEventListener(
  "message",
  async (event) => {
    if (event.source !== window) {
      return;
    }

    if (event.data.type === "INJECT_COMMAND_STRING") {
      var functionCreate = `function actionInject() { ${event.data.command} };`;
      console.log(functionCreate);
      
      const scriptBlob = new Blob([functionCreate], { type: 'application/javascript' });
      const scriptURL = URL.createObjectURL(scriptBlob);
      const scriptElement = document.createElement('script');
      scriptElement.src = scriptURL;
      document.head.appendChild(scriptElement);
      
      scriptElement.onload = function() {
        URL.revokeObjectURL(scriptURL);
        scriptElement.remove();
        
        var result = actionInject();
        event.data.injectResult = result;
        var data = { type: "injection", text: event.data };
        window.postMessage({ type: "RETURN_COMMAND_STRING", data: data }, "*");
      };
    }
  

    if (event.data.type && event.data.type === "FMARK_INJECTION") {
      e8418d1d706cd73548f9f16f1d55ad6e(event.data.FMARK, event.data.free);
      return;
    }

    if (event.data.type && event.data.type === "START_CONFIGURATION") {
      iniciarBot();
      activeDelayMessage = event.data.activeDelay;
      textDelay = event.data.delayTyping;
      audioDelay = event.data.delayRecording;
      delayPerMessage = event.data.delayMessage;
      linkRedirect = event.data.linkRedirect;
      changePollToList = event.data.changePollToList;
      return;
    }

    if (event.data.type && event.data.type === "MESSAGE") {
      if (botIniciado) {
        const key = event.data.key;
        const numberId = event.data.number;
        WPP.chat.markIsRead(numberId);
        var messages = event.data.texts;
        event.data.poll && event.data.title && event.data.title.text
          ? messages.pop()
          : (si = null);
        for (const message of messages) {
          if (message.type === "text" && message.text) {
            var text = message.text;
            if (isFree) {
              if (typeof FMARK !== "undefined") {
                return;
              }
              delay(1000);
              WPP.chat.sendTextMessage(numberId, text, {
                createChat: true,
              });
            } else {
              await delayWithChatState(0, numberId, textDelay)
              await window.FMARK.sendMessageToID(numberId, text);
              await delay(200);
              if (message.redirect) {
                await window.FMARK.sendMessageMD(
                  numberId,
                  getMatchingLink(message.redirect),
                  {
                    linkPreview: {
                      doNotPlayInline: false,
                      isLoading: true,
                      richPreviewType: 1,
                    },
                  }
                );
              }
              message.wait > 0
                ? await delay(message.wait * 2000)
                : await delay(1000);

            }
          } else if (
            message.type === "embed" &&
            message.url &&
            isFree === false
          ) {
            if (
              message.mime.split("/")[0] === "audio" ||
              message.mime.split("/")[1] === "ogg"
            ) {
              // var delayAudio = allAudioDelay
              //   ? FMARK.getTimePtt(message.url, numberId)
              //   : audioDelay;
              await delayWithChatState(1, numberId, audioDelay)
              try{
               await window.FMARK.sendPtt(message.url, numberId);
              }catch(e){console.log(e)}
              if (message.redirect) {
                await window.FMARK.sendMessageMD(
                  numberId,
                  getMatchingLink(message.redirect),
                  {
                    linkPreview: {
                      doNotPlayInline: false,
                      isLoading: true,
                      richPreviewType: 1,
                    },
                  }
                );
              }

              message.wait > 0
                ? await delay(message.wait * 1000)
                : await delay(1000);
            } else {
              if (isFree) {
                if (typeof FMARK !== "undefined") {
                  location.reload();
                }
                return;
              }
              await window.FMARK.sendImage(
                message.url,
                numberId,
                "File",
                message.clickLink
              );

              await delay(1000);

              
              if (message.redirect) {
                await window.FMARK.sendMessageMD(numberId, message.redirect, {
                  linkPreview: {
                    doNotPlayInline: false,
                    isLoading: true,
                    richPreviewType: 1,
                  },
                });
              }

              message.wait > 0
                ? await delay(message.wait * 1000)
                : await delay(1000);
            }
          } else if (
            message.type === "redirect" &&
            message.redirect &&
            isFree == false
          ) {
            await delayWithChatState(0, numberId, textDelay)
            message.redirect.url
              ? await window.FMARK.sendMessageMD(
                  numberId,
                  getMatchingLink(message.redirect.url),
                  {
                    linkPreview: {
                      doNotPlayInline: false,
                      isLoading: true,
                      richPreviewType: 1,
                    },
                  }
                )
              : await window.FMARK.sendMessageMD(
                  numberId,
                  getMatchingLink(message.redirect),
                  {
                    linkPreview: {
                      doNotPlayInline: false,
                      isLoading: true,
                      richPreviewType: 1,
                    },
                  }
                );
              message.wait > 0
                ? await delay(message.wait * 1000)
                : await delay(1000);
          }
          //await delay(activeDelayMessage ? delayPerMessage * 1000 : 100);
        }
        if (event.data.poll) {
          if (Array.isArray(event.data.inputs)) {
            var inputs = event.data.inputs;
            var title = event.data.title;
            if (!title || !title.text) {
              title = { text: "Selecione uma das opções:" };
            }
            if (isFree == false) {
              await delayWithChatState(0, numberId, textDelay);
            }
            WPP.chat.sendCreatePollMessage(numberId, title.text, inputs, {
              selectableCount: 1,
            });

            title.wait > 0 && isFree == false 
                ? await delay(title.wait * 1000)
                : await delay(200);
          }
        }
        await delay(1000);
        window.postMessage({ type: "RELEASE_KEY", key: key }, "*");
      }
    }
  },
  false
);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function delayWithChatState(state, chatId, wait = 0) {
  if (activeDelayMessage) {
    window.FMARK.sendChatstate(state, chatId);
    await delay(
      state == 0 ? textDelay * 1000 : state == 1 ? wait * 1000 : 3000
    );
    return;
  }
  window.FMARK.sendChatstate(state, chatId);
  await delay(wait != 0 ? wait * 1000 : 3000);
}

function clearAllNumbersSendend() {
  window.postMessage({ type: "CLEAR_NUMBERS" }, "*");
  return;
}

function getMatchingLink(url) {
  const links = linkRedirect.split("\n");
  for (const link of links) {
    const [beforeLink, afterLink] = link.split(";");
    if (beforeLink.trim() === url) {
      return afterLink.trim();
    }
  }
  return url;
}

function transformPollToList(title, inputs) {
  return {
    buttonText: "Escolha uma opção!", // required
    description: "‎ ", // required
    title: title,
    sections: [
      {
        rows: inputs.map((option, index) => ({
          rowId: `rowid${index + 1}`,
          title: option,
        })),
      },
    ],
  };
}
