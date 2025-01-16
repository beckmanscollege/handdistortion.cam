let kick, snare, hihat, drumLoop;
let isDrumPlaying = false;

// Setup drum synths
function setupDrumSynths() {
  // Kick drum
  kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    envelope: {
      attack: 0.001,
      decay: 0.4,
      sustain: 0.01,
      release: 1.4,
    },
  }).toDestination();

  // Snare drum
  snare = new Tone.NoiseSynth({
    noise: {
      type: "white",
    },
    envelope: {
      attack: 0.001,
      decay: 0.2,
    },
  }).toDestination();

  // Hi-hat
  hihat = new Tone.NoiseSynth({
    noise: {
      type: "pink",
    },
    envelope: {
      attack: 0.005,
      decay: 0.05,
    },
  }).toDestination();

  // Simple backbeat loop
  drumLoop = new Tone.Loop((time) => {
    // Kick on beats 1 and 3
    kick.triggerAttackRelease("C1", "16n", time); // Beat 1
    kick.triggerAttackRelease("C1", "16n", time + 1.5); // Beat 3

    // Snare on beats 2 and 4
    snare.triggerAttackRelease("8n", time + 1); // Beat 2
    snare.triggerAttackRelease("8n", time + 3); // Beat 4

    // Hi-hat on every eighth note
    hihat.triggerAttackRelease("16n", time);
    hihat.triggerAttackRelease("16n", time + 0.25);
    hihat.triggerAttackRelease("16n", time + 0.5);
    hihat.triggerAttackRelease("16n", time + 0.75);
  }, "1m");

  // Set BPM
  Tone.Transport.bpm.value = 175; // Adjust tempo to your liking
}

// Toggle drum loop
document.getElementById("toggleDrums").onclick = () => {
  if (!isDrumPlaying) {
    drumLoop.start(0); // Start the loop
    Tone.Transport.start(); // Start the audio transport
    isDrumPlaying = true;
  } else {
    drumLoop.stop(); // Stop the loop
    isDrumPlaying = false;
  }
};

// Start button functionality
document.getElementById("startButton").onclick = async () => {
  await Tone.start(); // Required to start audio in modern browsers
  console.log("Tone.js started.");
};

// Initialize the drum setup
setupDrumSynths();
