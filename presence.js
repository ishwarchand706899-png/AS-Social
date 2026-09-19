import { supabase } from "./supabase.js";

/* AS-SOCIAL GLOBAL PRESENCE
   One shared realtime room for the whole app.
*/

let channel = null;
let currentUser = null;

async function startGlobalPresence() {
    try {
        const { data, error } = await supabase.auth.getUser();

        if (error || !data?.user) {
            return;
        }

        currentUser = data.user;

        channel = supabase.channel("AS-Social-Global-Online", {
            config: {
                presence: {
                    key: String(currentUser.id)
                }
            }
        });

        channel.on("presence", { event: "sync" }, () => {
            window.dispatchEvent(
                new CustomEvent("as-presence-sync", {
                    detail: { onlineUsers: getOnlineUsers() }
                })
            );
            updateOnlineElements();
        });

        channel.on("presence", { event: "join" }, () => {
            updateOnlineElements();
        });

        channel.on("presence", { event: "leave" }, () => {
            updateOnlineElements();
        });

        channel.subscribe(async status => {
            console.log("AS-SOCIAL PRESENCE:", status);

            if (status === "SUBSCRIBED") {
                await trackMe();
            }
        });

    } catch (error) {
        console.error("GLOBAL PRESENCE ERROR:", error);
    }
}

async function trackMe() {
    if (!channel || !currentUser) return;

    try {
        await channel.track({
            userId: String(currentUser.id),
            online: true,
            lastSeen: new Date().toISOString()
        });

        document.documentElement.classList.add("as-online");
        updateOnlineElements();

        console.log("YOU ARE ONLINE 🟢");
    } catch (error) {
        console.error("PRESENCE TRACK ERROR:", error);
    }
}

function getOnlineUsers() {
    if (!channel) return [];

    const state = channel.presenceState();
    const ids = new Set();

    Object.entries(state).forEach(([key, entries]) => {
        if (key) ids.add(String(key));

        if (Array.isArray(entries)) {
            entries.forEach(entry => {
                const id =
                    entry?.userId ||
                    entry?.user_id ||
                    entry?.id;

                if (id) ids.add(String(id));
            });
        }
    });

    return [...ids];
}

function updateOnlineElements() {
    const onlineUsers = getOnlineUsers();

    document.querySelectorAll("[data-online-user]").forEach(el => {
        const userId = String(el.dataset.onlineUser);
        const online = onlineUsers.includes(userId);

        el.classList.toggle("show", online);
        el.classList.toggle("online", online);
        el.classList.toggle("offline", !online);

        if (el.dataset.onlineMode === "display") {
            el.style.display = online ? "inline-flex" : "none";
        }
    });

    if (currentUser) {
        const meOnline =
            onlineUsers.includes(String(currentUser.id));

        document.documentElement.classList.toggle(
            "as-online",
            meOnline
        );
    }
}

window.ASSocialPresence = {
    isOnline(userId) {
        return getOnlineUsers().includes(String(userId));
    },

    getOnlineUsers() {
        return getOnlineUsers();
    },

    refresh() {
        updateOnlineElements();
    }
};

window.addEventListener("online", async () => {
    console.log("INTERNET BACK 🟢");
    await trackMe();
});

window.addEventListener("offline", () => {
    console.log("INTERNET OFFLINE 🔴");
    document.documentElement.classList.remove("as-online");
});

window.addEventListener("beforeunload", () => {
    try {
        if (channel) {
            channel.untrack();
            supabase.removeChannel(channel);
        }
    } catch {}
});

startGlobalPresence();
