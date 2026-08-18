// 网络层：PeerJS 联机，房主为主机
let peer = null;
let hostConn = null;
let clientConns = new Map(); // host: peerId -> connection
let networkMode = 'solo'; // 'solo' | 'host' | 'client'
let networkReady = false;

function initNetwork(mode, roomId, callbacks) {
    networkMode = mode;
    if (mode === 'solo') {
        networkReady = true;
        if (callbacks.onReady) callbacks.onReady();
        return;
    }

    peer = new Peer(mode === 'host' ? ('chartbooker-' + roomId) : ('chartbooker-client-' + Date.now()), {
        debug: 1
    });

    peer.on('open', (id) => {
        networkReady = true;
        if (mode === 'host') {
            // 房主监听连接
            peer.on('connection', (conn) => {
                conn.on('open', () => {
                    clientConns.set(conn.peer, conn);
                    if (callbacks.onClientJoin) callbacks.onClientJoin(conn.peer);
                });
                conn.on('data', (data) => {
                    if (callbacks.onMessage) callbacks.onMessage(data, conn.peer);
                });
                conn.on('close', () => {
                    clientConns.delete(conn.peer);
                    if (callbacks.onClientLeave) callbacks.onClientLeave(conn.peer);
                });
            });
            if (callbacks.onReady) callbacks.onReady(id);
        } else {
            // 客户端连接房主
            hostConn = peer.connect('chartbooker-' + roomId, { reliable: true });
            hostConn.on('open', () => {
                if (callbacks.onReady) callbacks.onReady(id);
                hostConn.on('data', (data) => {
                    if (callbacks.onMessage) callbacks.onMessage(data, 'host');
                });
                hostConn.on('close', () => {
                    if (callbacks.onDisconnect) callbacks.onDisconnect();
                });
            });
            hostConn.on('error', (err) => {
                if (callbacks.onError) callbacks.onError(err);
            });
        }
    });

    peer.on('error', (err) => {
        if (callbacks.onError) callbacks.onError(err);
    });
}

function sendToHost(data) {
    if (hostConn && hostConn.open) hostConn.send(data);
}

function sendToClient(clientPeerId, data) {
    const conn = clientConns.get(clientPeerId);
    if (conn && conn.open) conn.send(data);
}

function broadcastToClients(data) {
    clientConns.forEach(conn => {
        if (conn.open) conn.send(data);
    });
}

function destroyNetwork() {
    try {
        if (hostConn) hostConn.close();
        clientConns.forEach(c => c.close());
        if (peer) peer.destroy();
    } catch {}
    hostConn = null;
    clientConns = new Map();
    peer = null;
    networkReady = false;
}
