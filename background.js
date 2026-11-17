// Sky Switch — toggles the "sky" light tile in an open Google Home tab.

const LIGHT_NAME = "sky"; // tile title, case-insensitive

// This function is serialized and injected into the Google Home tab.
function toggleLight(name) {
  const findTile = () => {
    const p = [...document.querySelectorAll("p.title")].find(
      (e) => e.textContent.trim().toLowerCase() === name
    );
    return p ? p.closest("button") : null;
  };

  const fire = (tile) => {
    const r = tile.getBoundingClientRect();
    const o = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      button: 0,
      pointerId: 1,
      isPrimary: true,
    };
    for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      tile.dispatchEvent(
        new (t.startsWith("pointer") ? PointerEvent : MouseEvent)(t, o)
      );
    }
  };

  const stateOf = (tile) => {
    const sub = [...tile.querySelectorAll("p,span")]
      .map((e) => e.textContent.trim())
      .find((t) => t === "On" || t === "Off");
    return sub || "?";
  };

  return new Promise((resolve) => {
    let tries = 0;
    const attempt = () => {
      const tile = findTile();
      if (tile) {
        const before = stateOf(tile);
        fire(tile);
        // report the state we expect after the toggle
        resolve(before === "On" ? "OFF" : before === "Off" ? "ON" : "~");
      } else if (++tries < 20) {
        setTimeout(attempt, 1000); // page may still be loading
      } else {
        resolve("ERR");
      }
    };
    attempt();
  });
}

async function badge(text, color) {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
}

async function run() {
  // Find an existing Google Home tab anywhere, any window.
  let [tab] = await chrome.tabs.query({ url: "https://home.google.com/*" });

  if (!tab) {
    // Open one in the background (pinned) and let it load.
    tab = await chrome.tabs.create({
      url: "https://home.google.com/home",
      active: false,
      pinned: true,
    });
    await new Promise((resolve) => {
      const listener = (id, info) => {
        if (id === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(resolve, 15000); // safety net
    });
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleLight,
      args: [LIGHT_NAME],
    });
    const state = result?.result || "ERR";
    if (state === "ERR") {
      badge("ERR", "#c5221f"); // tile never appeared (not logged in? renamed?)
    } else {
      badge(state, state === "ON" ? "#188038" : "#5f6368");
    }
  } catch (e) {
    badge("ERR", "#c5221f");
  }
}

chrome.action.onClicked.addListener(run);
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-sky") run();
});
