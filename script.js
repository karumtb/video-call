const socket = io('https://socket-zhra.onrender.com', {
  transports: ['websocket'],
});

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const shareScreenButton = document.getElementById('shareScreen');
const toggleVideoButton = document.getElementById('toggleVideo');
const toggleAudioButton = document.getElementById('toggleAudio');
const audioIcon = document.getElementById('audioIcon');
const disconnectCallButton = document.getElementById('disconnectCall');

let localStream;
let peerConnection;
let isCaller = false;
let remoteDescriptionSet = false;
let iceCandidateBuffer = [];
let isVideoEnabled = true;
let isAudioEnabled = true;

// === Create PeerConnection ===
function createPeerConnection() {
  const pc = new RTCPeerConnection();

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { type: 'ice-candidate', candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  return pc;
}

// === Handle Incoming Signal ===
socket.on('signal', async (data) => {
  switch (data.type) {
    case 'offer':
      if (!peerConnection) {
        peerConnection = createPeerConnection();
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      }
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      remoteDescriptionSet = true;

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit('signal', { type: 'answer', answer });

      for (const candidate of iceCandidateBuffer) {
        await peerConnection.addIceCandidate(candidate);
      }
      iceCandidateBuffer = [];
      break;

    case 'answer':
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      remoteDescriptionSet = true;

      for (const candidate of iceCandidateBuffer) {
        await peerConnection.addIceCandidate(candidate);
      }
      iceCandidateBuffer = [];
      break;

    case 'ice-candidate':
      if (remoteDescriptionSet) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      } else {
        iceCandidateBuffer.push(new RTCIceCandidate(data.candidate));
      }
      break;
  }
});

// === Start Call ===
startCallButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peerConnection = createPeerConnection();

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  isCaller = true;
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('signal', { type: 'offer', offer });
};

// === Share Screen ===
shareScreenButton.onclick = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const screenTrack = screenStream.getVideoTracks()[0];
  const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
  if (sender) sender.replaceTrack(screenTrack);

  screenTrack.onended = () => {
    sender.replaceTrack(localStream.getVideoTracks()[0]);
  };
};

// === Toggle Video ===
toggleVideoButton.onclick = () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  isVideoEnabled = !isVideoEnabled;
  videoTrack.enabled = isVideoEnabled;

  toggleVideoButton.textContent = isVideoEnabled ? 'Turn Video Off' : 'Turn Video On';
};
toggleAudioButton.onclick = () => {
  if (!localStream) return;

  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;

  isAudioEnabled = !isAudioEnabled;
  audioTrack.enabled = isAudioEnabled;

  // Update icon and label
  audioIcon.className = isAudioEnabled ? 'bi bi-mic-mute-fill' : 'bi bi-mic-fill';
  toggleAudioButton.classList.toggle('btn-danger', isAudioEnabled);
  toggleAudioButton.classList.toggle('btn-success', !isAudioEnabled);
};
disconnectCallButton.onclick = () => {
  if (peerConnection) {
    peerConnection.getSenders().forEach(sender => {
      try {
        sender.track && sender.track.stop();
      } catch (e) {
        console.warn('Track stop failed', e);
      }
    });

    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    localStream = null;
  }

  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }

  remoteDescriptionSet = false;
  iceCandidateBuffer = [];

  console.log('Call disconnected.');
};
