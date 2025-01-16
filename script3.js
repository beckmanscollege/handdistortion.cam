
let backgroundSynth;
let bass;
let synth;
let chorus;
let filter;
let distortion; // Distortion replaces phaser
let reverb;
let isSynthStarted = false;

// Chord progression: each chord plays for one measure



const chordProgression = [
  ["G2", "B2", "D3", "A3"], // Gmaj9
  ["A2", "C3", "E3", "G3"], // Am7
  ["D2", "F2", "A3", "C3"], // D7
  ["F2", "A2", "C3", "E3"], // Fmaj7
];

function setupSynth() {
  // Create a low-pass filter for the background synth
  filter = new Tone.Filter(200, "lowpass");

  // Create a Distortion effect
  distortion = new Tone.Distortion({
    distortion: 0.5, // Initial distortion amount
    wet: 0.5,        // Initial wet/dry mix
  });

  // Create a Reverb effect
  reverb = new Tone.Reverb({
    decay: 4,
    wet: 0,
  });

  // Create the background synth
  backgroundSynth = new Tone.PolySynth(Tone.Synth);

  // Add a Chorus effect to the background synth
  chorus = new Tone.Chorus({
    frequency: 1.5,
    delayTime: 3.5,
    depth: 0.7,
  }).start();

  // Connect backgroundSynth -> chorus -> distortion -> reverb -> filter -> destination
  backgroundSynth.connect(chorus);
  chorus.connect(distortion);
  distortion.connect(reverb);
  reverb.connect(filter);
  filter.toDestination();

  // Set background synth volume
  backgroundSynth.volume.value = -25;

  // Start the chord progression
  setupChordProgression();
}

// Set up the chord progression
function setupChordProgression() {
  let chordIndex = 0;

  Tone.Transport.scheduleRepeat((time) => {
    backgroundSynth.triggerAttackRelease(chordProgression[chordIndex], "1m", time);
    chordIndex = (chordIndex + 1) % chordProgression.length;
  }, "1m");

  Tone.Transport.bpm.value = 175;
  Tone.Transport.start();
}

document.getElementById("startButton").onclick = async () => {
  if (!isSynthStarted) {
    await Tone.start();
    setupSynth();
    isSynthStarted = true;
  }
};

// MediaPipe Hands setup
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => await hands.send({ image: videoElement }),
  width: 640,
  height: 480,
});
camera.start();

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Mirror the camera
  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1);

  // Draw the camera feed
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    
    // Always draw the hand visualization
    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#0f0', lineWidth: 2 });
    drawLandmarks(canvasCtx, landmarks, { color: '#f00', lineWidth: 1 });

    // Only process audio logic if the synth is started
    if (isSynthStarted) {
      const palmBase = landmarks[0];
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const pinkyTip = landmarks[20];

      // === Hand Openness (Thumb-Index Distance) → Volume Control ===
      const openness = Math.abs(thumbTip.x - indexTip.x);
      const volume = Math.min(1, openness * 5);
      backgroundSynth.volume.value = -25 + volume * 20;

      // === Hand Position (X) → Filter Frequency ===
      const handX = landmarks[9].x;
      const freq = 200 + handX * 1800;
      filter.frequency.value = freq;

      // === Hand Position (Y) → Distortion Amount ===
      const handY = landmarks[9].y;
      const distortionAmount = Math.min(1.0, Math.max(0.1, 1 - handY));
      distortion.distortion = distortionAmount;

      // === Gesture: Closed Hand → Toggle Reverb ===
      const isHandClosed = landmarks.every((landmark, i) => {
        const palm = landmarks[0];
        const isClose = Math.hypot(landmark.x - palm.x, landmark.y - palm.y) < 0.1;
        return i === 0 || isClose;
      });
      reverb.wet.value = isHandClosed ? 1 : 0;

      // === Chorus Depth (Middle Finger Distance to Palm) ===
      const middleDistance = Math.hypot(middleTip.x - palmBase.x, middleTip.y - palmBase.y);
      chorus.depth = Math.min(1, middleDistance * 10);

      // === Chorus Frequency (Hand Tilt) ===
      const tilt = Math.atan2(indexTip.y - palmBase.y, indexTip.x - palmBase.x);
      chorus.frequency.value = Math.max(0.5, Math.min(5, tilt * 5));

      // === Chorus Delay Time (Pinky Distance to Palm) ===
      const pinkyDistance = Math.hypot(pinkyTip.x - palmBase.x, pinkyTip.y - palmBase.y);
      chorus.delayTime = Math.max(0.1, Math.min(5, pinkyDistance * 10));

      // === Visual Feedback ===
      canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
      canvasCtx.fillRect(20, canvasElement.height - (freq / 2000) * canvasElement.height, 20, (freq / 2000) * canvasElement.height);

      canvasCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
      canvasCtx.fillRect(60, canvasElement.height - distortionAmount * canvasElement.height, 20, distortionAmount * canvasElement.height);

      canvasCtx.fillStyle = "rgba(0, 0, 255, 0.5)";
      canvasCtx.fillRect(100, canvasElement.height - volume * canvasElement.height, 20, volume * canvasElement.height);

      canvasCtx.fillStyle = "rgba(255, 255, 0, 0.5)";
      canvasCtx.fillRect(140, canvasElement.height - chorus.depth * canvasElement.height, 20, chorus.depth * canvasElement.height);
    }
  }

  canvasCtx.restore();
}

