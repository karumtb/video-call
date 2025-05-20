const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const shareScreenButton = document.getElementById('shareScreen');

let localStream;
let peer1;
let peer2;

startCallButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peer1 = new RTCPeerConnection();
  peer2 = new RTCPeerConnection();

  // Exchange ICE candidates
  peer1.onicecandidate = e => e.candidate && peer2.addIceCandidate(e.candidate);
  peer2.onicecandidate = e => e.candidate && peer1.addIceCandidate(e.candidate);

  // Remote stream
  peer2.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  // Add local tracks to peer1
  localStream.getTracks().forEach(track => peer1.addTrack(track, localStream));

  // SDP exchange
  const offer = await peer1.createOffer();
  await peer1.setLocalDescription(offer);
  await peer2.setRemoteDescription(offer);

  const answer = await peer2.createAnswer();
  await peer2.setLocalDescription(answer);
  await peer1.setRemoteDescription(answer);
};

shareScreenButton.onclick = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

  const screenTrack = screenStream.getVideoTracks()[0];
  const sender = peer1.getSenders().find(s => s.track.kind === 'video');
  sender.replaceTrack(screenTrack);

  screenTrack.onended = () => {
    sender.replaceTrack(localStream.getVideoTracks()[0]);
  };
};