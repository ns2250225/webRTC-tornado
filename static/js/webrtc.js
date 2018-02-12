const localVideo = document.getElementById('local_video');
const remoteVideo = document.getElementById('remote_video');
const chatMsgArea = document.getElementById('chat_messages');
const chatMsgInput = document.getElementById('chat_messages_input');
let localStream = null;
let peerConnection = null;
let dataChannel = null;
let receiveChannel = null;

// 设置websocket服务器地址
const wsUrl = 'ws://localhost:8000/';
const ws = new WebSocket(wsUrl);

// Websocket钩子方法
ws.onopen = function(evt) {
    console.log('ws open()');
};
ws.onerror = function(err) {
    console.error('ws onerror() ERR:', err);
};
ws.onmessage = function(evt) {
    console.log('ws onmessage() data:', evt.data);
    const message = JSON.parse(evt.data);
    if (message.type === 'offer') {
        // 收到 offer 时
        console.log('Received offer ...');
        const offer = new RTCSessionDescription(message);
        setOffer(offer);
    }
    else if (message.type === 'answer') {
        // 收到 answer 时
        console.log('Received answer ...');
        const answer = new RTCSessionDescription(message);
        setAnswer(answer);
    }
    else if (message.type === 'candidate') {
        // 收到 ICE candidate 时 
        console.log('Received ICE candidate ...');
        const candidate = new RTCIceCandidate(message.ice);
        console.log(candidate);
        addIceCandidate(candidate);
    }
    else if (message.type === 'close') {
        // 收到 close 信号时
        console.log('peer is closed ...');
        hangUp();
    }
};

// 添加 ICE candaidate 信息
function addIceCandidate(candidate) {
    if (peerConnection) {
        peerConnection.addIceCandidate(candidate);
    }
    else {
        console.error('PeerConnection not exist!');
        return;
    }
}

// ICE candidate 生成时发送消息
function sendIceCandidate(candidate) {
    console.log('---sending ICE candidate ---');
    const message = JSON.stringify({ type: 'candidate', ice: candidate });
    console.log('sending candidate=' + message);
    ws.send(message);
}

// getUserMedia 方法调用系统硬件
function startVideo() {
    navigator.mediaDevices.getUserMedia({video: true, audio: true})
        .then(function (stream) { // success
            playVideo(localVideo, stream);
            localStream = stream;
        }).catch(function (error) { // error
            console.error('mediaDevice.getUserMedia() error:', error);
            return;
    });
}

// Video 开启
function playVideo(element, stream) {
    element.srcObject = stream;
    element.play();
}

// Video 暂停
function stopVideo() {
    cleanupVideoElement(localVideo);
}


// dataChannel 接收回调
function receiveChannelCallback(event) {
    console.log('Receive Channel Callback');
    receiveChannel = event.channel;
    receiveChannel.onmessage = onReceiveMessageCallback;
    receiveChannel.onopen = onReceiveChannelStateChange;
    receiveChannel.onclose = onReceiveChannelStateChange;
}

function onReceiveMessageCallback(event) {
    console.log(event.data)
    chatMsgArea.append(event.data + '\n');
}

function onReceiveChannelStateChange() {
    console.log("open connection...")
}


// WebRTC 连接
function prepareNewConnection() {
    // RTCPeerConnection 初始化
    const pc_config = {"iceServers":[ {"urls":"stun:stun.skyway.io:3478"} ]};
    const peer = new RTCPeerConnection(pc_config);

    if ('ontrack' in peer) {
        peer.ontrack = function(event) {
            console.log('-- peer.ontrack()');
            playVideo(remoteVideo, event.streams[0]);
        };
    }
    else {
        peer.onaddstream = function(event) {
            console.log('-- peer.onaddstream()');
            playVideo(remoteVideo, event.stream);
        };
    }

    // 建立 data channels 连接
    dataChannel = peer.createDataChannel("chat", {ordered: false, maxRetransmitTime: 3000});
    // 建立 data channels 的回调
    peer.ondatachannel = receiveChannelCallback;

    // 收到 ICE Candidate 信息时
    peer.onicecandidate = function (evt) {
        console.log(`%%%%%%%%%%%`)
        console.log(evt)
        console.log(`%%%%%%%%%%%`)
        if (evt.candidate) {
            console.log(evt.candidate);
            sendIceCandidate(evt.candidate);
        } else {
            console.log('empty ice event');
            // sendSdp(peer.localDescription);
        }
    };

    // ICE 变更时
    peer.oniceconnectionstatechange = function() {
        console.log('ICE connection Status has changed to ' + peer.iceConnectionState);
        switch (peer.iceConnectionState) {
            case 'closed':
            case 'failed':
                if (peerConnection) {
                    hangUp();
                }
                break;
            case 'dissconnected':
                break;
        }
    };

    if (localStream) {
        console.log('Adding local stream...');
        peer.addStream(localStream);
    }
    else {
        console.warn('no local stream, but continue.');
    }

    return peer;
}

// 手动发送sdp消息
function sendSdp(sessionDescription) {
    console.log('---sending sdp ---');
    const message = JSON.stringify(sessionDescription);
    console.log('sending SDP=' + message);
    ws.send(message);
}

// 点击 Connect 的处理函数 
function connect() {
    if (! peerConnection) {
        console.log('make Offer');
        makeOffer();
    }
    else {
        console.warn('peer already exist.');
    }
}

// 点击 sendMsg 的处理函数
function sendMsg() {
    if (dataChannel) {
        const msg = chatMsgInput.value;
        console.log(msg)
        dataChannel.send(msg);
        chatMsgArea.append('me: ' + msg + '\n');
        chatMsgInput.value = '';
    }
}

// 生成 Offer SDP 信息
function makeOffer() {
    peerConnection = prepareNewConnection();
    peerConnection.onnegotiationneeded = function(){
        peerConnection.createOffer()
            .then(function (sessionDescription) {
                console.log('createOffer() succsess in promise');
                return peerConnection.setLocalDescription(sessionDescription);
            }).then(function() {
                console.log('setLocalDescription() succsess in promise');
                sendSdp(peerConnection.localDescription);
        }).catch(function(err) {
            console.error(err);
        });
    }
}

// 生成 Answer SDP 信息
function makeAnswer() {
    console.log('sending Answer. Creating remote session description...' );
    if (! peerConnection) {
        console.error('peerConnection NOT exist!');
        return;
    }
    peerConnection.createAnswer()
        .then(function (sessionDescription) {
            console.log('createAnswer() succsess in promise');
            return peerConnection.setLocalDescription(sessionDescription);
        }).then(function() {
            console.log('setLocalDescription() succsess in promise');
            sendSdp(peerConnection.localDescription);
    }).catch(function(err) {
        console.error(err);
    });
}

// Offer方处理SDP方法
function setOffer(sessionDescription) {
    if (peerConnection) {
        console.error('peerConnection alreay exist!');
    }
    peerConnection = prepareNewConnection();
    peerConnection.onnegotiationneeded = function () {
        peerConnection.setRemoteDescription(sessionDescription)
            .then(function() {
                console.log('setRemoteDescription(offer) succsess in promise');
                makeAnswer();
            }).catch(function(err) {
                console.error('setRemoteDescription(offer) ERROR: ', err);
        });
    }
}

// Answer方处理SDP方法
function setAnswer(sessionDescription) {
    if (! peerConnection) {
        console.error('peerConnection NOT exist!');
        return;
    }
    peerConnection.setRemoteDescription(sessionDescription)
        .then(function() {
            console.log('setRemoteDescription(answer) succsess in promise');
        }).catch(function(err) {
            console.error('setRemoteDescription(answer) ERROR: ', err);
    });
}

// 断开P2P通信连接
function hangUp(){
    if (peerConnection) {
        if(peerConnection.iceConnectionState !== 'closed'){
            peerConnection.close();
            peerConnection = null;
            const message = JSON.stringify({ type: 'close' });
            console.log('sending close message');
            ws.send(message);
            cleanupVideoElement(remoteVideo);
            return;
        }
    }
    console.log('peerConnection is closed.');
}

// 重置
function cleanupVideoElement(element) {
    element.pause();
    element.srcObject = null;
}