// ========================
// VIN-CINE REALTIME SERVER
// ========================
const express = require("express");
const app = express();
const http = require("http").createServer(app);

const io = require("socket.io")(http, {
    cors: { origin: "*" }
});

app.use(express.json());

// ========================
// GHẾ TẠM GIỮ
// ========================
let tempSeats = {};


// ========================
// API PHP GỌI
// ========================
app.post("/push", (req, res) => {
    const { type, data } = req.body || {};

    if (!type || !data) {
        return res.status(400).json({ ok: false, message: "Missing type or data" });
    }

    // 1) Gửi cho người trong phòng suất chiếu (nếu có)
    if (data.showtime_id) {
        io.to("showtime_" + data.showtime_id).emit(type, data);
    }

    // 2) Gửi GLOBAL
    io.emit(type, data);

    // 3) Dashboard event
    io.emit("dashboard_update", { type, data });

    // 4) Clear ghế tạm sau thanh toán
    if (type === "seat_booked_done") {
        const { showtime_id, seat_ids } = data;
        if (showtime_id && Array.isArray(seat_ids) && tempSeats[showtime_id]) {
            tempSeats[showtime_id] = tempSeats[showtime_id].filter(
                id => !seat_ids.includes(id)
            );
        }
    }

    return res.json({ ok: true });
});


// ========================
// SOCKET.IO REALTIME
// ========================
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join_showtime", (showtime_id) => {
        if (!showtime_id) return;
        socket.join("showtime_" + showtime_id);
        console.log(`Socket ${socket.id} joined showtime_${showtime_id}`);
    });

    socket.on("select_seat", (data) => {
        const { showtime_id, seat_id } = data || {};
        if (!showtime_id || !seat_id) return;

        if (!tempSeats[showtime_id]) tempSeats[showtime_id] = [];

        if (tempSeats[showtime_id].includes(seat_id)) {
            socket.emit("seat_rejected", seat_id);
            return;
        }

        tempSeats[showtime_id].push(seat_id);
        io.to("showtime_" + showtime_id).emit("seat_locked", seat_id);
    });

    socket.on("unselect_seat", (data) => {
        const { showtime_id, seat_id } = data || {};
        if (!showtime_id || !seat_id) return;

        if (!tempSeats[showtime_id]) return;

        tempSeats[showtime_id] = tempSeats[showtime_id].filter(id => id !== seat_id);

        io.to("showtime_" + showtime_id).emit("seat_unlocked", seat_id);
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});


// ========================
// START SERVER (LOCAL + ONLINE)
// ========================
const PORT = process.env.PORT || 10000;
http.listen(PORT, () => {
    console.log("Realtime server running on port " + PORT);
});
