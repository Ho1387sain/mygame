// Module aliases
const { Engine, Render, Runner, World, Bodies, Composite, Events, Mouse, MouseConstraint } = Matter;

// Game constants
const BUCKET_WIDTH = 350;
const BUCKET_HEIGHT = 500; // Make sure this matches your CSS
const WALL_THICKNESS = 20; // Thickness of the bucket walls

// Fruit definitions
// We'll use levels 0-7 for 8 types of fruits
// Radii and colors are placeholders, adjust as needed
// REMOVE THIS ENTIRE FRUIT_TYPES BLOCK:
/*  <-- REMOVE THIS LINE
const FRUIT_TYPES = [
    { level: 0, radius: 15, color: '#FF6666', emoji: '🍒', score: 10, spawnWeight: 60 }, // Cherry (Level 1)
    { level: 1, radius: 20, color: '#FFB266', emoji: '🍓', score: 20, spawnWeight: 30 }, // Strawberry (Level 2)
    { level: 2, radius: 25, color: '#FFFF66', emoji: '🍑', score: 30, spawnWeight: 10 }, // Peach (Level 3)
    { level: 3, radius: 30, color: '#B2FF66', emoji: '🍊', score: 40 }, // Orange (Level 4)
    { level: 4, radius: 35, color: '#66FFB2', emoji: '🍍', score: 50 }, // Pineapple (Level 5)
    { level: 5, radius: 40, color: '#66FFFF', emoji: '🍈', score: 60 }, // Melon (Level 6)
    { level: 6, radius: 45, color: '#66B2FF', emoji: '🍉', score: 70 }, // Watermelon (Level 7)
    { level: 7, radius: 50, color: '#B266FF', emoji: '🍇', score: 80 }  // Grapes (Level 8) - or some larger fruit
];
*/ // <-- REMOVE THIS LINE
// END OF BLOCK TO REMOVE  <-- REMOVE THIS LINE

// Game state
let currentFruit = null;
let removeAbilityCount = 3; // Initial count
let isRemoveAbilityActive = false;
let upgradeAbilityCount = 3; // Initial count for upgrade ability
let isUpgradeAbilityActive = false;
let nextFruitType = null;
let score = 0;
let bestScore = 0; // Add bestScore variable
let canDrop = true;
const dropCooldown = 500; // milliseconds

// Function to play merge animation (GIF focus)
function playMergeVideoAnimation(x, y) {
    const animationFile = 'assets/Animation.gif';
    const gameArea = document.getElementById('game-container') || document.body;

    const animElement = document.createElement('img');
    // Force reload with a unique query string
    animElement.src = animationFile + '?' + new Date().getTime(); 

    const animWidth = 100; // Adjust to your GIF's width
    const animHeight = 100; // Adjust to your GIF's height

    animElement.style.position = 'absolute';
    animElement.style.left = `${x - animWidth / 2}px`;
    animElement.style.top = `${y - animHeight / 2}px`;
    animElement.style.width = `${animWidth}px`;
    animElement.style.height = `${animHeight}px`;
    animElement.style.pointerEvents = 'none';
    animElement.style.zIndex = '1000';

    // IMPORTANT: You need to know the duration of your GIF's single loop.
    // Replace 1500 with the actual duration of your GIF in milliseconds.
    const gifDuration = 900; // e.g., 1.5 seconds. **Ensure this is accurate.**

    // Create a canvas to potentially hold the first frame
    const canvas = document.createElement('canvas');
    canvas.width = animWidth;
    canvas.height = animHeight;
    canvas.style.position = 'absolute';
    canvas.style.left = animElement.style.left;
    canvas.style.top = animElement.style.top;
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1000';
    const ctx = canvas.getContext('2d');

    let animationPlayedOnce = false;

    animElement.onload = () => {
        if (!animationPlayedOnce) {
            // Try to draw the first frame to the canvas immediately
            // This often captures the first frame for many GIFs
            try {
                ctx.drawImage(animElement, 0, 0, animWidth, animHeight);
            } catch (e) {
                console.warn('Could not draw GIF to canvas, might be cross-origin or timing issue.', e);
            }
            
            gameArea.appendChild(animElement);

            setTimeout(() => {
                if (gameArea.contains(animElement)) {
                    gameArea.removeChild(animElement);
                    // Optionally, show the canvas with the (hopefully) first frame
                    // gameArea.appendChild(canvas);
                    // And then remove the canvas after a bit if you want it to disappear too
                    // setTimeout(() => {
                    //     if (gameArea.contains(canvas)) {
                    //         gameArea.removeChild(canvas);
                    //     }
                    // }, 500); // How long to show the static frame
                }
                animationPlayedOnce = true;
            }, gifDuration);
        }
    };

    // Fallback if onload doesn't fire or GIF is already cached and onload doesn't re-trigger as expected
    // This is less reliable for the canvas snapshot but ensures the GIF is added and timed out.
    if (!animElement.complete) { // If not already loaded (e.g. from cache)
        // The onload event will handle it
    } else {
        // GIF might be cached and onload won't fire. Manually trigger logic.
        // This path is less likely to get a clean first frame on the canvas.
        if (!animationPlayedOnce) {
            gameArea.appendChild(animElement);
            setTimeout(() => {
                if (gameArea.contains(animElement)) {
                    gameArea.removeChild(animElement);
                }
                animationPlayedOnce = true;
            }, gifDuration);
        }
    }
}

// Sound manager for fruit merge sounds
const soundManager = {
    currentSound: null,
    
    playFruitSound: function(fruitType) {
        // Stop any currently playing sound
        if (this.currentSound) {
            this.currentSound.pause();
            this.currentSound.currentTime = 0;
        }
        
        // If this fruit has a sound file defined
        if (fruitType && fruitType.soundSrc) {
            // Create a new audio element
            const sound = new Audio(fruitType.soundSrc);
            sound.volume = 0.7; // Adjust volume as needed
            
            // Play the sound
            sound.play().catch(e => {
                console.warn('Sound play failed:', e);
            });
            
            // Store reference to current sound
            this.currentSound = sound;
            
            // Clear reference when sound ends
            sound.onended = () => {
                if (this.currentSound === sound) {
                    this.currentSound = null;
                }
            };
        }
    }
};

// DOM Elements
const gameContainer = document.getElementById('game-container');
const scoreDisplay = document.getElementById('score');
const bestScoreDisplay = document.getElementById('best-score'); // Add this line
const nextFruitEmojiDisplay = document.getElementById('next-fruit-emoji'); // We'll repurpose this for the image
const pauseButton = document.getElementById('pause-button');
const pauseMenu = document.getElementById('pause-menu');
// const resumeGameButton = document.getElementById('resume-game-button'); // This ID is no longer used for resume
const musicToggleButton = document.getElementById('music-toggle-button'); // New ID for music button
const restartGameButton = document.getElementById('restart-game-button');
const closePauseMenuButton = document.getElementById('close-pause-menu');
const gameOverlay = document.getElementById('game-overlay');
const dropLine = document.getElementById('drop-line'); // اضافه کردن مرجع به خط نشانگر

// DOM Elements for the abilities
const abilityRemoveIcon = document.getElementById('remove-ability'); // تغییر ID
const abilityRemoveCountDisplay = document.getElementById('ability-remove-count');
const abilityUpgradeIcon = document.getElementById('upgrade-ability'); // تغییر ID
const abilityUpgradeCountDisplay = document.getElementById('ability-upgrade-count');
const watchAdPopup = document.getElementById('watch-ad-popup');
const closeWatchAdPopupButton = document.getElementById('close-watch-ad-popup');
const watchAdButton = document.getElementById('watch-ad-btn');

// Game state
let isPaused = false;
let isMusicOn = true;

// Add audio element
const backgroundMusic = new Audio('assets/BgMusic.mp3'); // Replace with your file path
backgroundMusic.loop = true;
backgroundMusic.volume = 0.5;

// Start music only after user clicks or presses a key
let musicStarted = false;
function startMusicOnce() {
    if (!musicStarted) {
        backgroundMusic.play().catch((e) => {
            console.warn('Music play blocked:', e);
        });
        musicStarted = true;
    }
}

document.addEventListener('click', startMusicOnce);
document.addEventListener('keydown', startMusicOnce);

// Toggle music with M key
// Toggle music with M key
function toggleMusic() {
    if (!musicStarted) {
        // Start music if it hasn't started yet
        backgroundMusic.play().catch((e) => {
            console.warn('Music play blocked:', e);
        });
        musicStarted = true;
        isMusicOn = true;
    } else if (isMusicOn) {
        backgroundMusic.pause();
        isMusicOn = false;
        musicToggleButton.src = 'assets/MusicOffBtn.png';
    } else {
        backgroundMusic.play();
        isMusicOn = true;
        musicToggleButton.src = 'assets/MusicOnBtn.png';
    }
}

document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'm') {
        toggleMusic();
    }
});




// Create engine
const engine = Engine.create();
const world = engine.world;
world.gravity.y = 0.5; // Adjust gravity as needed

// Create renderer
const render = Render.create({
    element: gameContainer,
    engine: engine,
    options: {
        width: BUCKET_WIDTH,
        height: BUCKET_HEIGHT,
        wireframes: false, // Show solid shapes
        background: 'transparent' // Make renderer background transparent
    }
});
Render.run(render);
const gameCanvas = render.canvas; // Assuming 'render' is your Matter.js renderer

// Create runner
const runner = Runner.create();
Runner.run(runner, engine);

// Create bucket walls and floor
const wallOptions = {
    isStatic: true,
    restitution: 0.1, // Slight bounce
    friction: 0.5,
    render: {
        visible: false // Make the physical walls invisible
    }
};

const floor = Bodies.rectangle(BUCKET_WIDTH / 2, BUCKET_HEIGHT - WALL_THICKNESS / 2, BUCKET_WIDTH, WALL_THICKNESS, wallOptions);
const leftWall = Bodies.rectangle(WALL_THICKNESS / 2, BUCKET_HEIGHT / 2, WALL_THICKNESS, BUCKET_HEIGHT, wallOptions);
const rightWall = Bodies.rectangle(BUCKET_WIDTH - WALL_THICKNESS / 2, BUCKET_HEIGHT / 2, WALL_THICKNESS, BUCKET_HEIGHT, wallOptions);

// Add an invisible ceiling to detect game over
const ceiling = Bodies.rectangle(BUCKET_WIDTH / 2, 110, BUCKET_WIDTH, WALL_THICKNESS * 0.3, {
    isStatic: true,
    isSensor: true, // Doesn't collide physically, just detects
    label: 'gameOverLine',
    render: { visible: false } // Make it visible during development
});
const fruitTouchTimers = new Map();

Events.on(engine, 'collisionStart', function(event) {
    event.pairs.forEach(pair => {
        const { bodyA, bodyB } = pair;
        let fruit;

        if (bodyA.label === 'fruit' && bodyB.label === 'gameOverLine') fruit = bodyA;
        else if (bodyB.label === 'fruit' && bodyA.label === 'gameOverLine') fruit = bodyB;

        if (fruit && !fruitTouchTimers.has(fruit.id)) {
            const timer = setTimeout(() => {
                if (fruitTouchTimers.has(fruit.id)) {
                    console.log(`[DEBUG] Fruit ID ${fruit.id} stayed on ceiling for 2s`);
                    gameOver();
                }
            }, 1000);

            fruitTouchTimers.set(fruit.id, timer);
        }
    });
});


World.add(world, [floor, leftWall, rightWall, ceiling]);

// Function to get a random spawnable fruit type based on weights
function getRandomSpawnableFruitType() {
    const spawnableFruits = FRUIT_TYPES.filter(f => f.spawnWeight > 0);
    const totalWeight = spawnableFruits.reduce((sum, fruit) => sum + fruit.spawnWeight, 0);
    let randomNum = Math.random() * totalWeight;

    for (const fruit of spawnableFruits) {
        if (randomNum < fruit.spawnWeight) {
            return fruit;
        }
        randomNum -= fruit.spawnWeight;
    }
    return spawnableFruits[0]; // Fallback, should not happen if weights are correct
}

// Fruit definitions (This is the one we KEEP)
const FRUIT_TYPES = [
    // Example of a fruit that will use custom image and vertices
    {
        level: 0,
        score: 10,
        spawnWeight: 50, // Adjust spawn weight as needed
        imgSrc: 'assets/Assasino.png', // Path to your image
        soundSrc: 'assets/sounds/AssasionoSfx.mp3',
        imgWidth: 219,  // Actual pixel WIDTH of your image
        imgHeight: 227, // Actual pixel HEIGHT of your image
        vertices: [ // Using your provided vertices
            { "x": 28,  "y": 0 },    // Top-left
            { "x": 72,  "y": 0 },    // Top-right
            { "x": 95,  "y": 30 },   // Upper-right curve
            { "x": 92,  "y": 80 },   // Right shoulder
            { "x": 78,  "y": 112 },  // Right foot
            { "x": 50,  "y": 120 },  // Bottom center
            { "x": 22,  "y": 112 },  // Left foot
            { "x": 8,   "y": 80 },   // Left shoulder
            { "x": 5,   "y": 30 }    // Upper-left curve
          ],
        scale: 0.5,
        debugShowVertices: false, // Ensure this is false to test sprite/fill rendering
        // Optional: density: 0.1, friction: 0.1, restitution: 0
    },{
        level: 1,
        score: 90,
        spawnWeight: 30, // Adjust spawn weight as needed
        imgSrc: 'assets/Cap.png', // Path to your image
        soundSrc: 'assets/sounds/CapSfx.mp3',
        imgWidth: 355,  // Actual pixel WIDTH of your image
        imgHeight: 477, // Actual pixel HEIGHT of your image
        vertices: [ // Using your provided vertices
            { "x": 28,  "y": 0 },    // Top-left
            { "x": 72,  "y": 0 },    // Top-right
            { "x": 95,  "y": 30 },   // Upper-right curve
            { "x": 92,  "y": 80 },   // Right shoulder
            { "x": 78,  "y": 112 },  // Right foot
            { "x": 50,  "y": 120 },  // Bottom center
            { "x": 22,  "y": 112 },  // Left foot
            { "x": 8,   "y": 80 },   // Left shoulder
            { "x": 5,   "y": 30 }    // Upper-left curve
          ]
    // Example of a fruit that still uses a circle (if you haven't made assets for all)
   ,
        scale: 0.6,
        debugShowVertices: false, // Ensure this is false to test sprite/fill rendering
        // Optional: density: 0.1, friction: 0.1, restitution: 0
    }, {
        level: 2,
        score: 90,
        spawnWeight: 20, // Adjust spawn weight as needed
        imgSrc: 'assets/Wtf.png', // Path to your image
        soundSrc: 'assets/sounds/WtfSfx.mp3',
        imgWidth: 235,  // Actual pixel WIDTH of your image
        imgHeight: 223, // Actual pixel HEIGHT of your image
        vertices:[
            { "x": 117, "y": 0 },     // Top
            { "x": 185, "y": 30 },    // Upper-right curve
            { "x": 225, "y": 95 },    // Right
            { "x": 185, "y": 165 },   // Lower-right curve
            { "x": 117, "y": 223 },   // Bottom
            { "x": 49,  "y": 165 },   // Lower-left curve
            { "x": 9,   "y": 95 },    // Left
            { "x": 49,  "y": 30 }     // Upper-left curve
          ]
          
                    ,
        scale: 0.3,
        debugShowVertices: false, // Ensure this is false to test sprite/fill rendering
        // Optional: density: 0.1, friction: 0.1, restitution: 0
    }
   , {
        level: 3,
        score: 20,
        spawnWeight: 10, // Adjust spawn weight as needed
        imgSrc: 'assets/Shampi.png', // Path to your image
        soundSrc: 'assets/sounds/ShampiSfx.mp3',
        imgWidth: 179,  // Actual pixel WIDTH of your image
        imgHeight: 207, // Actual pixel HEIGHT of your image
        vertices: [ // Using your provided vertices
            { "x": 28,  "y": 0 },    // Top-left
            { "x": 72,  "y": 0 },    // Top-right
            { "x": 95,  "y": 30 },   // Upper-right curve
            { "x": 92,  "y": 80 },   // Right shoulder
            { "x": 78,  "y": 112 },  // Right foot
            { "x": 50,  "y": 120 },  // Bottom center
            { "x": 22,  "y": 112 },  // Left foot
            { "x": 8,   "y": 80 },   // Left shoulder
            { "x": 5,   "y": 30 }    // Upper-left curve
          ]
    // Add more fruit definitions here, following either the image/vertex pattern
    // or the radius/color pattern.
    // Make sure to define all levels you intend to use (0-7 or more).
   ,
        scale: 0.7,
        debugShowVertices: false, // Ensure this is false to test sprite/fill rendering
        // Optional: density: 0.1, friction: 0.1, restitution: 0
    },
    {
        level: 4,
        score: 10,
        spawnWeight: 0, // Adjust spawn weight as needed
        imgSrc: 'assets/Orangi.png', // Path to your image
        soundSrc: 'assets/sounds/OrangiSfx.mp3',
        imgWidth: 253,  // Actual pixel WIDTH of your image
        imgHeight: 282, // Actual pixel HEIGHT of your image
        vertices: [ // Using your provided vertices
            { "x": 28,  "y": 0 },    // Top-left
            { "x": 72,  "y": 0 },    // Top-right
            { "x": 95,  "y": 30 },   // Upper-right curve
            { "x": 92,  "y": 80 },   // Right shoulder
            { "x": 78,  "y": 112 },  // Right foot
            { "x": 50,  "y": 120 },  // Bottom center
            { "x": 22,  "y": 112 },  // Left foot
            { "x": 8,   "y": 80 },   // Left shoulder
            { "x": 5,   "y": 30 }    // Upper-left curve
          ],
        scale: 0.85,
        debugShowVertices: false, // Ensure this is false to test sprite/fill rendering
        // Optional: density: 0.1, friction: 0.1, restitution: 0
    }, {
        level: 5,
        score: 10,
        spawnWeight: 0, // Adjust spawn weight as needed
        imgSrc: 'assets/Ton.png', // Path to your image
        soundSrc: 'assets/sounds/TonSfx.mp3',
        imgWidth: 208,  // Actual pixel WIDTH of your image
        imgHeight: 272, // Actual pixel HEIGHT of your image
        vertices: [ // Using your provided vertices
            { "x": 28,  "y": 0 },    // Top-left
            { "x": 72,  "y": 0 },    // Top-right
            { "x": 95,  "y": 30 },   // Upper-right curve
            { "x": 92,  "y": 80 },   // Right shoulder
            { "x": 78,  "y": 112 },  // Right foot
            { "x": 50,  "y": 120 },  // Bottom center
            { "x": 22,  "y": 112 },  // Left foot
            { "x": 8,   "y": 80 },   // Left shoulder
            { "x": 5,   "y": 30 }    // Upper-left curve
          ]
    ,
        scale: 0.9,
        debugShowVertices: false, // Ensure this is false to test sprite/fill rendering
        // Optional: density: 0.1, friction: 0.1, restitution: 0
    },{
        level: 6,
        score: 10,
        spawnWeight: 0, // Adjust spawn weight as needed
        imgSrc: 'assets/Bir.png', // Path to your image
        soundSrc: 'assets/sounds/BirSfx.mp3',
        imgWidth: 331,  // Actual pixel WIDTH of your image
        imgHeight: 458, // Actual pixel HEIGHT of your image
        vertices:[
            { x: 165, y: 0 },
            { x: 210, y: 30 },
            { x: 245, y: 70 },
            { x: 270, y: 115 },
            { x: 290, y: 165 },
            { x: 305, y: 215 },
            { x: 315, y: 265 },
            { x: 320, y: 315 },
            { x: 320, y: 365 },
            { x: 315, y: 410 },
            { x: 290, y: 458 },
            { x: 245, y: 458 },
            { x: 210, y: 430 },
            { x: 165, y: 410 },
            { x: 120, y: 430 },
            { x: 90,  y: 458 },
            { x: 40,  y: 458 },
            { x: 25,  y: 410 },
            { x: 25,  y: 350 },
            { x: 45,  y: 275 }
          ]
          
          
          
    ,
        scale: 0.35,
        debugShowVertices: false, // Ensure this is false to test sprite/fill rendering
        // Optional: density: 0.1, friction: 0.1, restitution: 0
    },
    {
        level: 7,
        score: 90,
        spawnWeight: 0, // Adjust spawn weight as needed
        imgSrc: 'assets/Tra.png', // Path to your image
        soundSrc: 'assets/sounds/TraSfx.mp3',
        imgWidth: 345,  // Actual pixel WIDTH of your image
        imgHeight: 316, // Actual pixel HEIGHT of your image
        vertices: [
            { x: 172, y: 0 },
            { x: 210, y: 20 },
            { x: 245, y: 50 },
            { x: 270, y: 85 },
            { x: 290, y: 130 },
            { x: 305, y: 175 },
            { x: 315, y: 220 },
            { x: 320, y: 260 },
            { x: 320, y: 300 },
            { x: 310, y: 315 },
            { x: 275, y: 316 },
            { x: 230, y: 300 },
            { x: 190, y: 275 },
            { x: 150, y: 260 },
            { x: 110, y: 275 },
            { x: 75,  y: 300 },
            { x: 40,  y: 316 },
            { x: 25,  y: 300 },
            { x: 10,  y: 250 },
            { x: 15,  y: 190 }
          ]
          ,
        scale: 0.4,
        debugShowVertices: false, // Ensure this is false to test sprite/fill rendering
        // Optional: density: 0.1, friction: 0.1, restitution: 0
    },{
        level: 8,
        score: 10,
        spawnWeight: 0, // Adjust spawn weight as needed
        imgSrc: 'assets/Bomb.png', // Path to your image
        soundSrc: 'assets/sounds/BombSfx.mp3',
        imgWidth: 453,  // Actual pixel WIDTH of your image
        imgHeight: 325, // Actual pixel HEIGHT of your image
        vertices: [
            { x: 226, y: 0 },
            { x: 280, y: 25 },
            { x: 325, y: 60 },
            { x: 365, y: 105 },
            { x: 395, y: 155 },
            { x: 420, y: 200 },
            { x: 435, y: 245 },
            { x: 445, y: 285 },
            { x: 450, y: 320 },
            { x: 440, y: 325 },
            { x: 390, y: 325 },
            { x: 330, y: 300 },
            { x: 270, y: 275 },
            { x: 215, y: 260 },
            { x: 160, y: 275 },
            { x: 105, y: 300 },
            { x: 60,  y: 320 },
            { x: 20,  y: 315 },
            { x: 10,  y: 270 },
            { x: 20,  y: 210 }
          ]
          
    ,
        scale: 0.35,
        debugShowVertices: false, // Ensure this is false to test sprite/fill rendering
        // Optional: density: 0.1, friction: 0.1, restitution: 0
    },
    {
        level: 9,
        score: 90,
        spawnWeight: 0, // Adjust spawn weight as needed
        imgSrc: 'assets/Liri.png', // Path to your image
        soundSrc: 'assets/sounds/LiriSfx.mp3',
        imgWidth: 420,  // Actual pixel WIDTH of your image
        imgHeight: 470, // Actual pixel HEIGHT of your image
        vertices: [ // Using your provided vertices
            { "x": 28,  "y": 0 },    // Top-left
            { "x": 72,  "y": 0 },    // Top-right
            { "x": 95,  "y": 30 },   // Upper-right curve
            { "x": 92,  "y": 80 },   // Right shoulder
            { "x": 78,  "y": 112 },  // Right foot
            { "x": 50,  "y": 120 },  // Bottom center
            { "x": 22,  "y": 112 },  // Left foot
            { "x": 8,   "y": 80 },   // Left shoulder
            { "x": 5,   "y": 30 }    // Upper-left curve
          ],
        scale: 1.15,
        debugShowVertices: false, // Ensure this is false to test sprite/fill rendering
        // Optional: density: 0.1, friction: 0.1, restitution: 0
    }
];

// Function to create a new fruit body
function createFruitBody(x, y, fruitType) {
    let fruitBody;
    const commonOptions = {
        restitution: 0.3,
        friction: 0.1,
        density: fruitType.density !== undefined ? fruitType.density : 0.001,
        label: 'fruit',
        fruitType: fruitType,
        hasFallen: false, // Add this flag to track if the fruit has fallen
    };

    // Ensure this logic correctly handles the restored vertex-based level 0
    if (fruitType.vertices && fruitType.vertices.length > 0 && fruitType.imgSrc) {
        // Create from vertices if vertices and imgSrc are provided
        const vertexSets = Array.isArray(fruitType.vertices[0]) ? fruitType.vertices : [fruitType.vertices];

        fruitBody = Bodies.fromVertices(x, y, vertexSets, { 
            ...commonOptions,
        }, /* flagInternal */ false, /* removeCollinear */ 0.01, /* minimumArea */ 10);

        // Apply scaling if defined for the fruit type
        if (fruitType.scale && fruitType.scale !== 1 && fruitBody) {
            Matter.Body.scale(fruitBody, fruitType.scale, fruitType.scale);
            if (fruitType.level === 0) { // Log after scaling for Assasino
                console.log(`[DEBUG Assasino Scale] Body ID: ${fruitBody.id} scaled by ${fruitType.scale}. New bounds: min.x=${fruitBody.bounds.min.x.toFixed(2)}, min.y=${fruitBody.bounds.min.y.toFixed(2)}, max.x=${fruitBody.bounds.max.x.toFixed(2)}, max.y=${fruitBody.bounds.max.y.toFixed(2)}`);
            }
        }

        // Conditional rendering for debugging vertices or showing sprite
        if (fruitType.debugShowVertices && fruitBody) {
            fruitBody.render.sprite = undefined; 
            fruitBody.render.fillStyle = 'rgba(50, 205, 50, 0.6)'; 
            fruitBody.render.strokeStyle = '#000000'; 
            fruitBody.render.lineWidth = 1;
            if (fruitType.level === 0) {
                 console.log(`[DEBUG Assasino Render] Rendering debug vertices for Body ID: ${fruitBody.id}`);
            }
        } else if (fruitBody) {
            // This block is for when debugShowVertices is false.
            // Apply sprite rendering to ALL fruits with vertices/imgSrc, including level 0.

            // Explicitly set render properties to ensure visibility and no fill interference
            fruitBody.render.visible = true;
            fruitBody.render.fillStyle = null; // Or 'transparent' if null doesn't work

            // Ensure the sprite object exists before setting its properties
            if (!fruitBody.render.sprite) {
                fruitBody.render.sprite = {};
            }
            
            fruitBody.render.sprite.texture = fruitType.imgSrc;
            
            // Scale the sprite to the physics body's dimensions
            if (fruitType.imgWidth && fruitType.imgHeight && fruitType.imgWidth > 0 && fruitType.imgHeight > 0) {
                const physicsBodyWidth = fruitBody.bounds.max.x - fruitBody.bounds.min.x;
                const physicsBodyHeight = fruitBody.bounds.max.y - fruitBody.bounds.min.y;

                // LOGGING FOR ASSASINO FRUIT (LEVEL 0) - Keep this for verification
                if (fruitType.level === 0) {
                    console.log(`[DEBUG Assasino Sprite] Body ID: ${fruitBody.id}`);
                    console.log(`[DEBUG Assasino Sprite] fruitBody.bounds (used for sprite scale): min.x=${fruitBody.bounds.min.x.toFixed(2)}, min.y=${fruitBody.bounds.min.y.toFixed(2)}, max.x=${fruitBody.bounds.max.x.toFixed(2)}, max.y=${fruitBody.bounds.max.y.toFixed(2)}`);
                    console.log(`[DEBUG Assasino Sprite] physicsBodyWidth: ${physicsBodyWidth.toFixed(2)}, physicsBodyHeight: ${physicsBodyHeight.toFixed(2)}`);
                    console.log(`[DEBUG Assasino Sprite] fruitType.imgWidth: ${fruitType.imgWidth}, fruitType.imgHeight: ${fruitType.imgHeight}`);
                }

                if (physicsBodyWidth <= 0 || physicsBodyHeight <= 0) {
                    if (fruitType.level === 0) { 
                        console.error(`[DEBUG Assasino Sprite] Invalid physics body dimensions for sprite scaling: W=${physicsBodyWidth.toFixed(2)}, H=${physicsBodyHeight.toFixed(2)}. Sprite will be invisible or incorrectly scaled.`);
                    }
                    // Attempt to give it a tiny visible scale
                    fruitBody.render.sprite.xScale = 0.001; 
                    fruitBody.render.sprite.yScale = 0.001;
                } else {
                    fruitBody.render.sprite.xScale = physicsBodyWidth / fruitType.imgWidth;
                    fruitBody.render.sprite.yScale = physicsBodyHeight / fruitType.imgHeight;
                }

                // LOGGING FOR ASSASINO FRUIT (LEVEL 0) - Keep this for verification
                if (fruitType.level === 0) {
                    console.log(`[DEBUG Assasino Sprite] Calculated xScale: ${fruitBody.render.sprite.xScale.toFixed(4)}, yScale: ${fruitBody.render.sprite.yScale.toFixed(4)}`);
                    if (isNaN(fruitBody.render.sprite.xScale) || isNaN(fruitBody.render.sprite.yScale) || !isFinite(fruitBody.render.sprite.xScale) || !isFinite(fruitBody.render.sprite.yScale)) {
                        console.error("[DEBUG Assasino Sprite] CRITICAL: xScale or yScale is NaN or Infinite! This will make the sprite invisible.");
                    }
                }

            } else {
                console.warn("Fruit type", fruitType.emoji || `L${fruitType.level}`, "is missing or has invalid imgWidth/imgHeight for sprite scaling. Sprite will be unscaled.");
                if (fruitBody.render.sprite) { // Check if sprite object exists before setting scale
                    fruitBody.render.sprite.xScale = 1;
                    fruitBody.render.sprite.yScale = 1;
                }
            }
        }

    } else if (fruitType.radius && fruitType.color) {
        // Fallback to circle if no vertices/imgSrc or for fruits defined with radius/color
        // THIS BLOCK WILL NOW HANDLE THE TEMPORARY LEVEL 0 CIRCLE
        fruitBody = Bodies.circle(x, y, fruitType.radius, {
            ...commonOptions,
            render: {
                fillStyle: fruitType.color,
            }
        });
    } else {
        // Fallback for misconfigured fruit type - create a small default circle
        console.warn("Misconfigured fruitType, creating default circle:", fruitType);
        fruitBody = Bodies.circle(x, y, 10, { // Default small radius
            ...commonOptions,
            render: { fillStyle: 'gray' } // Default color
        });
    }
    return fruitBody;
}

// Function to prepare the next fruit
function prepareNextFruit() {
    console.log("prepareNextFruit called.");
    if (!nextFruitType) { // First fruit
        nextFruitType = getRandomSpawnableFruitType();
    }
    const fruitTypeToDrop = nextFruitType;
    nextFruitType = getRandomSpawnableFruitType();

    // مخفی کردن خط نشانگر تا زمانی که موس حرکت کند
    if (dropLine) {
        dropLine.style.display = 'none';
    }

    console.log("Preparing to drop:", fruitTypeToDrop.emoji || `L${fruitTypeToDrop.level}`, "Next in preview:", nextFruitType.emoji || `L${nextFruitType.level}`);

    // Create an image element for the next fruit
    nextFruitEmojiDisplay.innerHTML = '';
    const nextFruitImg = document.createElement('img');
    nextFruitImg.src = nextFruitType.imgSrc;
    nextFruitImg.style.width = '30px';
    nextFruitImg.style.height = '30px';
    nextFruitImg.style.verticalAlign = 'middle';
    nextFruitEmojiDisplay.appendChild(nextFruitImg);

    let initialYPosition;
    // Estimate initial Y position based on shape type
    if (fruitTypeToDrop.vertices && fruitTypeToDrop.imgHeight && fruitTypeToDrop.imgHeight > 0) {
        // For vertex shapes, use a fraction of its image height.
        initialYPosition = fruitTypeToDrop.imgHeight * 0.15 + 10;
    } else if (fruitTypeToDrop.radius) {
        initialYPosition = fruitTypeToDrop.radius + 10;
    } else {
        initialYPosition = 30; // Fallback
    }
    // Ensure initialYPosition is not NaN
    if (isNaN(initialYPosition)) initialYPosition = 30;

    currentFruit = createFruitBody(mouseX, initialYPosition, fruitTypeToDrop);
    if (!currentFruit) {
        console.error("Failed to create currentFruit for type:", fruitTypeToDrop.level);
        return;
    }
    currentFruit.isSleeping = true;
    currentFruit.isStatic = true;

    World.add(world, currentFruit);
    canDrop = true;
    console.log("New currentFruit prepared:", currentFruit.fruitType.level, "isStatic:", currentFruit.isStatic, "canDrop:", canDrop, "at y:", currentFruit.position.y.toFixed(2));
}

// Update the ability count display function to handle both abilities
function updateAbilityCountDisplay() {
    if (abilityRemoveCountDisplay) {
        abilityRemoveCountDisplay.textContent = removeAbilityCount;
    }
    if (abilityUpgradeCountDisplay) {
        abilityUpgradeCountDisplay.textContent = upgradeAbilityCount;
    }
}

// Update remove ability display (for backward compatibility)
function updateRemoveAbilityDisplay() {
    if (abilityRemoveCountDisplay) {
        abilityRemoveCountDisplay.textContent = removeAbilityCount;
    }
}

// Function to show watch ad popup for both abilities
function showWatchAdPopup(abilityType) {
    if (watchAdPopup) {
        // Store the ability type being refilled
        watchAdPopup.dataset.abilityType = abilityType;
        
        // نمایش اورلی پشت منو
        gameOverlay.classList.remove('hidden');
        
        // نمایش منو با انیمیشن باز شدن
        watchAdPopup.classList.remove('hidden');
        watchAdPopup.classList.add('opening');

        // Center the popup container itself
        watchAdPopup.style.position = 'fixed'; 
        watchAdPopup.style.top = '50%';
        watchAdPopup.style.left = '50%';
        watchAdPopup.style.transform = 'translate(-50%, -50%)'; // Explicitly center the parent popup
        
        // The child div's animation (openMenu/closeMenu) will then run within this centered parent.
        const popupContent = watchAdPopup.querySelector('div');
        if (popupContent) {
            // Reset styles for animation if re-opening
            popupContent.style.transform = ''; // Or specific initial state for openMenu if needed
            popupContent.style.opacity = '';
            
            // اجرای انیمیشن پس از نمایش منو
            setTimeout(() => {
                popupContent.style.transform = 'scale(1)';
                popupContent.style.opacity = '1';
            }, 10);
        }
    }
}

// Function to activate/deactivate remove ability
function toggleRemoveAbility() {
    if (isRemoveAbilityActive) { // Currently active, so deactivate
        isRemoveAbilityActive = false;
        if (gameCanvas) gameCanvas.classList.remove('remove-cursor-active');
        if (abilityRemoveIcon) abilityRemoveIcon.style.border = 'none';
        console.log('Remove ability deactivated.');
        // If a fruit is ready at the top, allow dropping it.
        if (currentFruit && currentFruit.isStatic) {
            canDrop = true;
        }
        // If currentFruit is null, canDrop state is managed by drop cooldown/prepareNextFruit.
    } else { // Currently inactive, so activate
        if (removeAbilityCount > 0) {
            isRemoveAbilityActive = true;
            if (gameCanvas) gameCanvas.classList.add('remove-cursor-active');
            if (abilityRemoveIcon) abilityRemoveIcon.style.border = '2px solid yellow';
            console.log('Remove ability activated. Click a fruit to remove.');
            canDrop = false; // Prevent normal dropping while ability is active
            
            // Deactivate upgrade ability if it's active
            if (isUpgradeAbilityActive) {
                isUpgradeAbilityActive = false;
                gameCanvas.classList.remove('upgrade-cursor-active');
                if (abilityUpgradeIcon) abilityUpgradeIcon.style.border = 'none';
            }
        } else {
            showWatchAdPopup('remove');
            console.log('No remove ability left. Showing ad popup.');
        }
    }
}

// Function to upgrade a fruit to the next level
function upgradeFruit(fruit) {
    if (!fruit || !fruit.fruitType) return false; // Return false if no fruit
    
    const currentLevel = fruit.fruitType.level;
    const nextLevel = currentLevel + 1;

    // Check if the fruit is already the highest level
    if (currentLevel === FRUIT_TYPES.length - 1) {
        console.log("Cannot upgrade the highest level fruit.");
        // Deactivate ability visuals but don't consume charge (handled in handleFruitClick)
        if (isUpgradeAbilityActive) {
            // Visual deactivation will be handled by handleFruitClick after this returns false
        }
        return false; // Indicate upgrade was not performed
    }
    
    // Check if next level exists
    const nextLevelFruitType = FRUIT_TYPES.find(type => type.level === nextLevel);
    if (!nextLevelFruitType) {
        console.log("No higher level fruit available for upgrade");
        return false; // Indicate upgrade was not performed
    }
    
    // Get current position
    const position = { x: fruit.position.x, y: fruit.position.y };
    
    // Remove the current fruit
    World.remove(world, fruit);
    
    // Create new fruit of next level
    const upgradedFruit = createFruitBody(position.x, position.y, nextLevelFruitType);
    World.add(world, upgradedFruit);
    
    // Play animation at the position
    playMergeVideoAnimation(position.x, position.y);
    
    // Play sound for the upgraded fruit
    soundManager.playFruitSound(nextLevelFruitType);
    
    // Add score for the upgrade
    score += nextLevelFruitType.score;
    scoreDisplay.textContent = score;
    
    // Deactivate upgrade ability (visuals handled in handleFruitClick)
    // isUpgradeAbilityActive = false; // This will be set in handleFruitClick
    // gameCanvas.classList.remove('upgrade-cursor-active');
    return true; // Indicate upgrade was successful
}

// Function to activate upgrade ability
function activateUpgradeAbility() {
    if (upgradeAbilityCount <= 0) {
        // Show ad popup or notification that no upgrades are available
        showWatchAdPopup('upgrade');
        return;
    }
    
    // Toggle the ability state
    isUpgradeAbilityActive = !isUpgradeAbilityActive;
    
    // Deactivate remove ability if it's active
    if (isRemoveAbilityActive) {
        isRemoveAbilityActive = false;
        gameCanvas.classList.remove('remove-cursor-active');
        if (abilityRemoveIcon) abilityRemoveIcon.style.border = 'none';
    }
    
    // Update cursor and visual feedback
    if (isUpgradeAbilityActive) {
        gameCanvas.classList.add('upgrade-cursor-active');
        if (abilityUpgradeIcon) abilityUpgradeIcon.style.border = '2px solid yellow';
        console.log('Upgrade ability activated. Click a fruit to upgrade.');
        canDrop = false; // Prevent normal dropping while ability is active
    } else {
        gameCanvas.classList.remove('upgrade-cursor-active');
        if (abilityUpgradeIcon) abilityUpgradeIcon.style.border = 'none';
        console.log('Upgrade ability deactivated.');
        // If a fruit is ready at the top, allow dropping it.
        if (currentFruit && currentFruit.isStatic) {
            canDrop = true;
        }
    }
    
    // Update UI
    updateAbilityCountDisplay();
}

// Event listener for the ability icons
if (abilityRemoveIcon) {
    abilityRemoveIcon.addEventListener('click', () => {
        toggleRemoveAbility();
    });
}

if (abilityUpgradeIcon) {
    abilityUpgradeIcon.addEventListener('click', activateUpgradeAbility);
}

// Event listener for closing the ad popup
if (closeWatchAdPopupButton) {
    closeWatchAdPopupButton.addEventListener('click', () => {
        if (watchAdPopup) {
            // انیمیشن بستن منو
            watchAdPopup.classList.remove('opening');
            watchAdPopup.classList.add('closing');
            
            const popupContent = watchAdPopup.querySelector('div');
            if (popupContent) {
                popupContent.style.transform = 'scale(0.1)';
                popupContent.style.opacity = '0';
            }
            
            // بعد از اتمام انیمیشن، منو را مخفی می‌کنیم
            setTimeout(() => {
                watchAdPopup.classList.remove('closing');
                watchAdPopup.classList.add('hidden');
                gameOverlay.classList.add('hidden');
            }, 300); // زمان انیمیشن
        }
    });
}

// Function to handle watching ads for abilities
function watchAdForAbility() {
    const abilityType = watchAdPopup.dataset.abilityType || 'remove';
    
    // Simulate watching an ad (in a real game, you'd show an actual ad here)
    console.log(`Watching ad for ${abilityType} ability...`);
    
    // After ad is complete, refill the appropriate ability
    if (abilityType === 'remove') {
        removeAbilityCount += 3;
    } else if (abilityType === 'upgrade') {
        upgradeAbilityCount += 3;
    }
    
    // Update UI
    updateAbilityCountDisplay();
    
    // انیمیشن بستن منو
    watchAdPopup.classList.remove('opening');
    watchAdPopup.classList.add('closing');
    
    const popupContent = watchAdPopup.querySelector('div');
    if (popupContent) {
        popupContent.style.transform = 'scale(0.1)';
        popupContent.style.opacity = '0';
    }
    
    // بعد از اتمام انیمیشن، منو را مخفی می‌کنیم
    setTimeout(() => {
        watchAdPopup.classList.remove('closing');
        watchAdPopup.classList.add('hidden');
        gameOverlay.classList.add('hidden');
    }, 300); // زمان انیمیشن
}

// Event listener for the watch ad button
if (watchAdButton) {
    watchAdButton.addEventListener('click', watchAdForAbility);
}

// Mouse control for aiming
let mouseX = BUCKET_WIDTH / 2;

gameContainer.addEventListener('mousemove', (event) => {
    if (isPaused || !currentFruit || !currentFruit.fruitType) return;

    const rect = gameContainer.getBoundingClientRect();
    let newX = event.clientX - rect.left;

    let fruitBoundaryOffset = 0; 

    if (currentFruit.fruitType.vertices && currentFruit.bounds) {
        const bodyWidth = currentFruit.bounds.max.x - currentFruit.bounds.min.x;
        fruitBoundaryOffset = bodyWidth / 2;
    } else if (currentFruit.fruitType.radius) {
        fruitBoundaryOffset = currentFruit.fruitType.radius;
    } else {
        fruitBoundaryOffset = 15; 
        console.warn("Could not determine fruitBoundaryOffset accurately for fruit:", currentFruit.fruitType);
    }

    if (isNaN(fruitBoundaryOffset)) {
        fruitBoundaryOffset = 15; 
        console.warn("Calculated fruitBoundaryOffset was NaN, using fallback.");
    }

    newX = Math.max(fruitBoundaryOffset + WALL_THICKNESS, newX);
    newX = Math.min(BUCKET_WIDTH - fruitBoundaryOffset - WALL_THICKNESS, newX);
    mouseX = newX;

    if (currentFruit.isStatic) {
        Matter.Body.setPosition(currentFruit, { x: mouseX, y: currentFruit.position.y });
        
        if (dropLine) {
            console.log('Drop line update triggered'); // Check if this block is reached
            const fruitY = currentFruit.position.y;
            const visualFruitBottom = fruitY + fruitBoundaryOffset; 
            
            dropLine.style.display = 'block';
            dropLine.style.width = '10px'; 
            dropLine.style.left = (mouseX - (parseInt(dropLine.style.width, 10) / 2)) + 'px'; 
            dropLine.style.top = visualFruitBottom + 'px'; 
            
            const effectiveBucketFloorY = BUCKET_HEIGHT - WALL_THICKNESS; 
            let lineHeight = effectiveBucketFloorY - visualFruitBottom;
            lineHeight = Math.max(0, lineHeight);
            dropLine.style.height = lineHeight + 'px';
            
            // Log the calculated styles
            console.log('DropLine styles:', 
                'display:', dropLine.style.display, 
                'width:', dropLine.style.width, 
                'height:', dropLine.style.height, 
                'left:', dropLine.style.left, 
                'top:', dropLine.style.top
            );
            console.log('BUCKET_HEIGHT:', BUCKET_HEIGHT, 'WALL_THICKNESS:', WALL_THICKNESS, 'fruitY:', fruitY, 'visualFruitBottom:', visualFruitBottom);
        }
    }
});
Events.on(engine, 'collisionEnd', function(event) {
    event.pairs.forEach(pair => {
        const { bodyA, bodyB } = pair;
        let fruit;

        if (bodyA.label === 'fruit' && bodyB.label === 'gameOverLine') fruit = bodyA;
        else if (bodyB.label === 'fruit' && bodyA.label === 'gameOverLine') fruit = bodyB;

        if (fruit && fruitTouchTimers.has(fruit.id)) {
            clearTimeout(fruitTouchTimers.get(fruit.id));
            fruitTouchTimers.delete(fruit.id);
        }
    });
});

// Function to handle fruit clicks for abilities
function handleFruitClick(event) {
    if (isPaused) return;
    
    // Get mouse position relative to canvas
    const rect = gameCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Find clicked fruit
    const clickedBody = Matter.Query.point(Composite.allBodies(world), { x: mouseX, y: mouseY })
        .find(body => body.label === 'fruit');
    
    if (clickedBody) {
        if (isRemoveAbilityActive) {
            // Remove the fruit
            World.remove(world, clickedBody);
            removeAbilityCount--;
            isRemoveAbilityActive = false;
            gameCanvas.classList.remove('remove-cursor-active');
            if (abilityRemoveIcon) abilityRemoveIcon.style.border = 'none';
            updateAbilityCountDisplay();
            console.log(`Fruit removed. ${removeAbilityCount} removals left.`);
            if (currentFruit && clickedBody.id === currentFruit.id) {
                currentFruit = null;
                console.log("Removed the current preview fruit.");
            }
            // Re-enable fruit dropping if a fruit is ready
            if (currentFruit && currentFruit.isStatic) {
                canDrop = true;
            }
        } else if (isUpgradeAbilityActive) {
            const upgradeSuccessful = upgradeFruit(clickedBody);
            if (upgradeSuccessful) {
                upgradeAbilityCount--;
                console.log(`Fruit upgraded. ${upgradeAbilityCount} upgrades left.`);
            } else {
                console.log("Upgrade failed or fruit is max level. Ability not consumed.");
            }
            // Always deactivate ability visuals and state after an attempt
            isUpgradeAbilityActive = false;
            gameCanvas.classList.remove('upgrade-cursor-active');
            if (abilityUpgradeIcon) abilityUpgradeIcon.style.border = 'none';
            updateAbilityCountDisplay();
            // Re-enable fruit dropping if a fruit is ready
            if (currentFruit && currentFruit.isStatic) {
                canDrop = true;
            }
        }
    } else if (isRemoveAbilityActive || isUpgradeAbilityActive) {
        console.log('No fruit clicked for ability or clicked fruit had no vertices.');
        // Reset ability states if no fruit was clicked
        if (isRemoveAbilityActive) {
            isRemoveAbilityActive = false;
            gameCanvas.classList.remove('remove-cursor-active');
            if (abilityRemoveIcon) abilityRemoveIcon.style.border = 'none';
        }
        if (isUpgradeAbilityActive) {
            isUpgradeAbilityActive = false;
            gameCanvas.classList.remove('upgrade-cursor-active');
            if (abilityUpgradeIcon) abilityUpgradeIcon.style.border = 'none';
        }
        // Re-enable fruit dropping if a fruit is ready
        if (currentFruit && currentFruit.isStatic) {
            canDrop = true;
        }
    }
}

// Event listener for dropping fruit and abilities
if (gameCanvas) { // Check if gameCanvas is initialized
    // Add event listener for fruit clicks
    gameCanvas.addEventListener('click', handleFruitClick);
    
    gameCanvas.addEventListener('mousedown', function(event) {
        if (isPaused) return;
        
        // Skip if abilities are active - they're handled by the click event
        if (isRemoveAbilityActive || isUpgradeAbilityActive) {
            return;
        }

        // Existing fruit dropping logic (only if not in remove mode and canDrop is true)
        if (currentFruit && currentFruit.isStatic && canDrop) {
            const fruitIdentifierText = currentFruit.fruitType ? (currentFruit.fruitType.emoji || `L${currentFruit.fruitType.level}`) : 'UnknownFruit';
            console.log(
                "Mousedown event for dropping. currentFruit:", fruitIdentifierText,
                "isStatic:", currentFruit.isStatic,
                "canDrop:", canDrop
            );

            const droppingFruitIdentifier = currentFruit.fruitType.emoji || `L${currentFruit.fruitType.level}`;
            console.log("Dropping fruit:", droppingFruitIdentifier);

            // مخفی کردن خط نشانگر
            if (dropLine) {
                dropLine.style.display = 'none';
            }

            Matter.Body.setStatic(currentFruit, false);
            Matter.Sleeping.set(currentFruit, false); // Ensure it's awake
            console.log("Fruit made dynamic. isStatic is now:", currentFruit.isStatic, "isSleeping is now:", currentFruit.isSleeping);

            currentFruit = null; // Release control
            console.log("currentFruit set to null.");

            canDrop = false; // Prevent immediate re-drop until cooldown finishes

            setTimeout(() => {
                console.log("Drop cooldown finished. Calling prepareNextFruit.");
                prepareNextFruit(); // This will set canDrop = true again
            }, dropCooldown);
        } else {
            let reason = "";
            if (!currentFruit) reason = "currentFruit is null.";
            else if (!currentFruit.isStatic) reason = "currentFruit is not static.";
            else if (!canDrop) reason = "drop is on cooldown or ability was just toggled off.";
            else reason = "condition not met.";
            if (reason && !(currentFruit && currentFruit.isStatic && !canDrop) ) { // Avoid redundant log if only canDrop is false due to recent toggle
              console.log("Cannot drop: " + reason);
            }
        }
    });
} else {
    console.error("gameCanvas is not initialized. Mouse down listener for drop/remove not added.");
}

// Collision handling for merging
Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    const uniqueBodiesToRemove = new Set(); // Store actual body objects to prevent duplicate processing
    const fruitsToCreate = [];

    pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        if (bodyA.label === 'fruit' && bodyB.label === 'fruit') {
            // Ensure we haven't already processed these exact body objects for removal in this tick
            if (uniqueBodiesToRemove.has(bodyA) || uniqueBodiesToRemove.has(bodyB)) {
                if (bodyA.fruitType.level === 0 && bodyB.fruitType.level === 0) {
                    console.log(`[DEBUG] Skipping merge for pair involving already processed Level 0 body. BodyA: ${bodyA.id}, BodyB ID: ${bodyB.id}`);
                }
                return; // One or both bodies in this pair are already marked for removal
            }

            const fruitADef = bodyA.fruitType;
            const fruitBDef = bodyB.fruitType;

            if (fruitADef.level === 0 && fruitBDef.level === 0) {
                console.log(`[DEBUG] Potential merge: Level 0 fruits. BodyA ID: ${bodyA.id}, BodyB ID: ${bodyB.id}`);
            }

            if (fruitADef.level === fruitBDef.level && fruitADef.level < FRUIT_TYPES.length - 1) {
                const currentLevel = fruitADef.level;
                
                // Mark actual body objects for removal
                uniqueBodiesToRemove.add(bodyA);
                uniqueBodiesToRemove.add(bodyB);

                const mergeX = (bodyA.position.x + bodyB.position.x) / 2;
                const mergeY = (bodyA.position.y + bodyB.position.y) / 2;
                const nextLevel = currentLevel + 1;
                const newFruitType = FRUIT_TYPES.find(f => f.level === nextLevel);

                if (currentLevel === 0) {
                    console.log(`[DEBUG] Marked Level 0 bodies for removal: BodyA ID: ${bodyA.id}, BodyB ID: ${bodyB.id}`);
                    console.log(`[DEBUG] Queuing creation of Level ${nextLevel} fruit at (${mergeX.toFixed(2)}, ${mergeY.toFixed(2)})`);
                }

                if (newFruitType) {
                    fruitsToCreate.push({ x: mergeX, y: mergeY, fruitType: newFruitType, score: newFruitType.score });
                    playMergeVideoAnimation(mergeX, mergeY); // <--- ADD THIS LINE
                } else {
                    if (currentLevel === 0) {
                        console.error(`[DEBUG] CRITICAL: Could not find fruit type definition for next level: ${nextLevel} during merge planning.`);
                    }
                }
            }
        }

        // Game Over Check: Ensure bodies are not already marked for removal by the merge logic above
        if (!uniqueBodiesToRemove.has(bodyA) && !uniqueBodiesToRemove.has(bodyB)) {
            if ((bodyA.label === 'fruit' && bodyB.label === 'gameOverLine' && !bodyA.isStatic) ||
                (bodyB.label === 'fruit' && bodyA.label === 'gameOverLine' && !bodyB.isStatic)) {
                const fruit = bodyA.label === 'fruit' ? bodyA : bodyB;
                const gameOverThreshold = fruit.fruitType.radius ? fruit.fruitType.radius * 1.5 : (fruit.bounds.max.y - fruit.bounds.min.y) * 0.5; 
                if (fruit.position.y < gameOverThreshold) {
                    console.log(`[DEBUG] Game Over triggered by fruit ID ${fruit.id} at Y: ${fruit.position.y}`);
                    gameOver();
                }
            }
        }
    });

    // Perform actual removals and additions after iterating through all pairs
    if (uniqueBodiesToRemove.size > 0) {
        console.log(`[DEBUG] Attempting to remove ${uniqueBodiesToRemove.size} bodies from the world.`);
        uniqueBodiesToRemove.forEach(bodyToRemove => {
            const bodyIdForLog = bodyToRemove.id; // Store ID for logging in case bodyToRemove becomes invalid
            const bodyLevelForLog = bodyToRemove.fruitType ? bodyToRemove.fruitType.level : 'Unknown';

            const stillInWorldBeforeRemove = Composite.get(world, bodyIdForLog, 'body');

            if (stillInWorldBeforeRemove) {
                World.remove(world, bodyToRemove); // Use the direct body reference
                console.log(`[DEBUG] Called World.remove for fruit (ID: ${bodyIdForLog}, Level: ${bodyLevelForLog}).`);
                
                // Check immediately after removal call
                const stillInWorldAfterRemoveCall = Composite.get(world, bodyIdForLog, 'body');
                if (stillInWorldAfterRemoveCall) {
                    console.error(`[DEBUG] CRITICAL CHECK 1: Fruit (ID: ${bodyIdForLog}) STILL IN WORLD via Composite.get() IMMEDIATELY AFTER World.remove call!`);
                } else {
                    console.log(`[DEBUG] CHECK 1: Fruit (ID: ${bodyIdForLog}) NO LONGER IN WORLD via Composite.get() immediately after World.remove call.`);
                }
            } else {
                 console.warn(`[DEBUG] PRE-REMOVE CHECK: Fruit (ID: ${bodyIdForLog}, Level: ${bodyLevelForLog}) was already NOT IN WORLD according to Composite.get() before explicit World.remove call.`);
            }
        });

        // After all removal calls in this tick are done, check the world's body list
        console.log(`[DEBUG] CHECK 2: Verifying all removed bodies against Composite.allBodies(world)`);
        const allCurrentBodyIdsInWorld = Composite.allBodies(world).map(b => b.id);
        console.log(`[DEBUG] IDs of all bodies reported by Composite.allBodies(world): ${allCurrentBodyIdsInWorld.join(', ') || 'None'}`);

        uniqueBodiesToRemove.forEach(bodyThatShouldBeRemoved => {
            if (allCurrentBodyIdsInWorld.includes(bodyThatShouldBeRemoved.id)) {
                console.error(`[DEBUG] CRITICAL CHECK 2: Body ID ${bodyThatShouldBeRemoved.id} (Level: ${bodyThatShouldBeRemoved.fruitType.level}) which was targeted for removal IS STILL PRESENT in Composite.allBodies(world)!`);
            } else {
                 console.log(`[DEBUG] CHECK 2: Body ID ${bodyThatShouldBeRemoved.id} (Level: ${bodyThatShouldBeRemoved.fruitType.level}) which was targeted for removal is CORRECTLY ABSENT from Composite.allBodies(world).`);
            }
        });
    }

    if (fruitsToCreate.length > 0) {
        fruitsToCreate.forEach(data => {
            const newFruit = createFruitBody(data.x, data.y, data.fruitType);
            if (newFruit) {
                World.add(world, newFruit);
                score += data.score;
                scoreDisplay.textContent = score;
                
                // Play the sound for the new fruit type
                soundManager.playFruitSound(data.fruitType);
                
                if (data.fruitType.level === 1 && FRUIT_TYPES.find(f => f.level === 0)?.spawnWeight > 0) {
                    console.log(`[DEBUG] Successfully CREATED and ADDED new Level 1 fruit (ID: ${newFruit.id}) to world.`);
                }
            } else {
                 if (data.fruitType.level === 1) { // Check if it was a level 0 merge target
                    console.error("[DEBUG] CRITICAL: Failed to create new Level 1 fruit body post-iteration!");
                 }
            }
        });
    }
});

function gameOver() {
    if (isPaused) return; // Don't trigger game over if already paused or game over sequence started
    console.log("Game Over sequence initiated.");
    isPaused = true; // Use isPaused to prevent further actions
    Runner.stop(runner);
    // Render.stop(render); // Optional: Stop rendering if you want to freeze the frame
    canDrop = false;
    // It's important currentFruit is nullified if it exists and is part of the world
    if (currentFruit && Composite.get(world, currentFruit.id, 'body')) {
        World.remove(world, currentFruit);
    }
    currentFruit = null;

    // Show the game overlay (darkened background)
    gameOverlay.classList.remove('hidden');

    // Check if game over popup already exists
    let gameOverDiv = document.getElementById('game-over-message');
    
    if (!gameOverDiv) {
        // Create the game over popup if it doesn't exist
        gameOverDiv = document.createElement('div');
        gameOverDiv.id = 'game-over-message';
        document.body.appendChild(gameOverDiv);
        
        // Apply styles to match the pause menu
        gameOverDiv.style.position = 'absolute';
        gameOverDiv.style.top = '50%';
        gameOverDiv.style.left = '50%';
        gameOverDiv.style.transform = 'translate(-50%, -50%) scale(0.1)';
        gameOverDiv.style.opacity = '0';
        gameOverDiv.style.color = 'white';
        gameOverDiv.style.textAlign = 'center';
        gameOverDiv.style.zIndex = '1001';
        gameOverDiv.style.backgroundImage = "url('assets/Popup.png')";
        gameOverDiv.style.backgroundSize = 'contain';
        gameOverDiv.style.backgroundRepeat = 'no-repeat';
        gameOverDiv.style.backgroundPosition = 'center';
        gameOverDiv.style.width = '600px';
        gameOverDiv.style.height = '450px';
        gameOverDiv.style.display = 'flex';
        gameOverDiv.style.flexDirection = 'column';
        gameOverDiv.style.justifyContent = 'center';
        gameOverDiv.style.alignItems = 'center';
        gameOverDiv.style.padding = '20px';
    }

    // Update the content of the game over popup
    gameOverDiv.innerHTML = `
        <h2 style="color: red; margin-top: 0; margin-bottom: 20px; font-size: 1.8em;">GAME OVER!</h2>
        <p style="margin-bottom: 20px; font-size: 1.4em;">Final Score: ${score}</p>
        <img src="assets/RetryBtn.png" id="gameOverRestartBtn" class="menu-image-button" alt="Restart Game" style="cursor: pointer; width: 150px; height: auto; margin: 10px 0; transition: transform 0.2s ease-in-out;">
    `;
    
    // نمایش منو با انیمیشن باز شدن
    gameOverDiv.style.display = 'flex';
    gameOverDiv.classList.add('opening');
    
    // Add event listener for the restart button
    const gameOverRestartBtn = document.getElementById('gameOverRestartBtn');
    if (gameOverRestartBtn) {
        gameOverRestartBtn.addEventListener('click', () => {
            // انیمیشن بستن منو
            gameOverDiv.classList.remove('opening');
            gameOverDiv.classList.add('closing');
            
            // بعد از اتمام انیمیشن، منو را مخفی می‌کنیم
            setTimeout(() => {
                gameOverDiv.style.display = 'none';
                gameOverDiv.classList.remove('closing');
                gameOverlay.classList.add('hidden');
                // Restart the game
                restartGame();
            }, 300); // زمان انیمیشن
        });
        
        // Add hover and active effects
        gameOverRestartBtn.addEventListener('mouseover', () => {
            gameOverRestartBtn.style.transform = 'scale(1.08)';
        });
        gameOverRestartBtn.addEventListener('mouseout', () => {
            gameOverRestartBtn.style.transform = 'scale(1)';
        });
        gameOverRestartBtn.addEventListener('mousedown', () => {
            gameOverRestartBtn.style.transform = 'scale(0.95)';
        });
        gameOverRestartBtn.addEventListener('mouseup', () => {
            gameOverRestartBtn.style.transform = 'scale(1.08)';
        });
    }
}

function togglePause() {
    if (!isPaused) {
        // بازی را متوقف می‌کنیم
        Runner.stop(runner);
        canDrop = false; // جلوگیری از رها کردن میوه در حالت توقف
        
        // نمایش اورلی پشت منو
        gameOverlay.classList.remove('hidden');
        
        // نمایش منو با انیمیشن باز شدن
        pauseMenu.style.transform = 'translate(-50%, -50%) scale(0.1)';
        pauseMenu.style.opacity = '0';
        pauseMenu.classList.remove('hidden');
        
        // اجرای انیمیشن پس از نمایش منو
        setTimeout(() => {
            pauseMenu.style.transform = 'translate(-50%, -50%) scale(1)';
            pauseMenu.style.opacity = '1';
        }, 10);
        
        isPaused = true;
        console.log("Game Paused");
    } else {
        // انیمیشن بستن منو
        pauseMenu.style.transform = 'translate(-50%, -50%) scale(0.1)';
        pauseMenu.style.opacity = '0';
        
        // بعد از اتمام انیمیشن، منو را مخفی می‌کنیم
        setTimeout(() => {
            pauseMenu.classList.add('hidden');
            
            // ادامه بازی
            Runner.run(runner, engine);
            
            // اجازه رها کردن میوه اگر میوه‌ای آماده است
            if (currentFruit && currentFruit.isStatic) {
                canDrop = true;
            } else {
                canDrop = false;
            }
            
            // مخفی کردن اورلی
            gameOverlay.classList.add('hidden');
        }, 300); // زمان انیمیشن
        
        isPaused = false;
        console.log("Game Resumed");
    }
}

function toggleMusic() {
    isMusicOn = !isMusicOn;
    if (isMusicOn) {
        backgroundMusic.play();
        musicToggleButton.src = 'assets/MusicOnBtn.png';
        console.log("Music ON");
    } else {
        backgroundMusic.pause();
        musicToggleButton.src = 'assets/MusicOffBtn.png';
        console.log("Music OFF");
    }
}

function restartGame() {
    console.log("Restarting game...");

    // ✅ Stop runner only if needed
    if (runner.enabled) {
        Runner.stop(runner);
    }

    // ✅ Clear ceiling timers
    fruitTouchTimers.forEach(timer => clearTimeout(timer));
    fruitTouchTimers.clear();

    // ✅ Remove all fruit bodies
    const allFruits = Composite.allBodies(world).filter(body => body.label === 'fruit');
    World.remove(world, allFruits);

    // ✅ Hide Game Over popup with animation if it exists
    const gameOverMessage = document.getElementById('game-over-message');
    if (gameOverMessage && gameOverMessage.style.display !== 'none') {
        gameOverMessage.classList.remove('opening');
        gameOverMessage.classList.add('closing');
        
        setTimeout(() => {
            gameOverMessage.style.display = 'none';
            gameOverMessage.classList.remove('closing');
        }, 300);
    }

    // ✅ Reset game state
    score = 0;
    scoreDisplay.textContent = score;
    isPaused = false;
    canDrop = false;
    currentFruit = null;
    nextFruitType = null;

    // ✅ Reset gravity (to avoid physics slowdown bug)
    engine.world.gravity.y = 0.5;

    // ✅ Clean up pause UI if open
    pauseMenu.classList.add('hidden');
    gameOverlay.classList.add('hidden');

    // ✅ Reset abilities
    removeAbilityCount = 3;
    upgradeAbilityCount = 3;
    updateAbilityCountDisplay();
    
    // Deactivate abilities if active
    if (isRemoveAbilityActive) {
        isRemoveAbilityActive = false;
        gameCanvas.classList.remove('remove-cursor-active');
        if (abilityRemoveIcon) abilityRemoveIcon.style.border = 'none';
    }
    
    if (isUpgradeAbilityActive) {
        isUpgradeAbilityActive = false;
        gameCanvas.classList.remove('upgrade-cursor-active');
        if (abilityUpgradeIcon) abilityUpgradeIcon.style.border = 'none';
    }

    // ✅ Start runner cleanly
    runner.enabled = true;
    Runner.run(runner, engine);

    // ✅ Delay fruit spawn slightly so it doesn't auto-drop
    setTimeout(() => {
        prepareNextFruit();
    }, 100);
}





// Game Initialization
function startGame() {
    console.log("Fruit Merge Game Initializing!");
    console.log("Bucket dimensions:", BUCKET_WIDTH, "x", BUCKET_HEIGHT);
    console.log("Click inside the bucket area to drop fruits.");

    // Set up initial game state
    score = 0;
    scoreDisplay.textContent = score;
    isPaused = false;
    canDrop = true; // Ensure canDrop is initially true
    updateRemoveAbilityDisplay(); // Initialize display for remove ability

    // Event Listeners for buttons
    if (pauseButton) {
        pauseButton.addEventListener('click', togglePause);
    } else {
        console.error("Pause button not found");
    }

    if (musicToggleButton) {
        musicToggleButton.addEventListener('click', toggleMusic);
        // Set initial music button image based on isMusicOn state
        musicToggleButton.src = isMusicOn ? 'assets/MusicOnBtn.png' : 'assets/MusicOffBtn.png';
    } else {
        console.error("Music toggle button not found");
    }

    if (restartGameButton) { // This is the restart button in the pause menu
        restartGameButton.addEventListener('click', () => {
            if (isPaused) togglePause(); // Close pause menu first
            restartGame();
        });
    } else {
        console.error("Restart game button (pause menu) not found");
    }

    if (closePauseMenuButton) {
    closePauseMenuButton.addEventListener('click', () => {
        if (isPaused) togglePause(); // بستن منو با انیمیشن
    });
} else {
    console.error("Close pause menu button not found");
}

    // Initial music state
    // Initial music state
if (isMusicOn) {
    backgroundMusic.play().catch(e => {
        console.warn("Music autoplay prevented:", e);
        // Set a flag to try again on first interaction
        document.addEventListener('click', function tryAutoplayOnce() {
            backgroundMusic.play();
            musicStarted = true;
            document.removeEventListener('click', tryAutoplayOnce);
        }, { once: true });
    });
    musicStarted = true;
}


    // Prepare the very first fruit
    prepareNextFruit();
    Runner.run(runner, engine); // Ensure runner starts
}

// Start the game when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', startGame);

// console.log("Fruit Merge Game Initialized!"); // Moved to startGame