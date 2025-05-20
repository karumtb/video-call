const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const shareScreenButton = document.getElementById('shareScreen');

const socket = io('https://socket-zhra.onrender.com', {
  path: '/',
  transports: ['websocket'],
  secure: true
});
let localStream;
let peer;

socket.on('signal', async (data) => {
  if (data.type === 'offer') {
    await setupPeer(false);
    await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit('signal', { type: 'answer', answer });
  }

  if (data.type === 'answer') {
    await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
  }

  if (data.type === 'candidate') {
    try {
      await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (err) {
      console.error('Error adding received ice candidate', err);
    }
  }
});

async function setupPeer(isCaller) {
  peer = new RTCPeerConnection();

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { type: 'candidate', candidate: event.candidate });
    }
  };

  peer.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  localStream.getTracks().forEach((track) => {
    peer.addTrack(track, localStream);
  });

  if (isCaller) {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit('signal', { type: 'offer', offer });
  }
}

startCallButton.onclick = () => setupPeer(true);

shareScreenButton.onclick = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const screenTrack = screenStream.getVideoTracks()[0];
  const sender = peer.getSenders().find(s => s.track.kind === 'video');
  sender.replaceTrack(screenTrack);

  screenTrack.onended = () => {
    sender.replaceTrack(localStream.getVideoTracks()[0]);
  };
};
