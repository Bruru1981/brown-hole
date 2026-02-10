'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { Play, RotateCcw, Trophy, Heart, Maximize2 } from 'lucide-react'

// --- Types ---
interface Ball {
  x: number
  y: number
  dx: number
  dy: number
  radius: number
  image?: HTMLImageElement | null
}

interface Paddle {
  x: number
  y: number
  width: number
  height: number
  color: string
}

interface Brick {
  x: number
  y: number
  width: number
  height: number
  status: number
  color: string
  health: number
  maxHealth: number
  type: 'normal' | 'unbreakable'
}

interface Particle {
  x: number
  y: number
  dx: number
  dy: number
  life: number
  color: string
}

interface PowerUp {
  x: number
  y: number
  dy: number
  type: 'blue_balls' | 'jizztime'
  width: number
  height: number
}

// --- Constants & Assets ---
const CHARACTERS = [
  { name: 'Smashly', image: '/assets/smashly.png', color: '#ec4899' },
  { name: 'Sagi Tits', image: '/assets/sagitits.png', color: '#8b5cf6' },
]

const MOTIVATIONAL_MESSAGES = [
  "A la la la la long",
  "Sweat till you can't sweat no more",
  "Girl I want to make you sweat",
  "Push it some more",
  "I never lie",
  "Dave's not here, man",
  "Pistols at dawn !",
  "You look so skinny, Alice"
]

// --- Helper: Beautiful Colors ---
// Using a more vibrant, "beautiful" palette instead of muddy browns
const COLORS = {
  background: 'linear-gradient(to bottom, #000000, #1a1a1a)', // Black gradient
  paddle: '#facc15', // Yellow
  text: '#ffffff',
  brickColors: [
    '#f472b6', // Pink 400
    '#a78bfa', // Violet 400
    '#60a5fa', // Blue 400
    '#34d399', // Emerald 400
  ],
  unbreakable: '#475569', // Slate 600
  hole: '#3f2e18', // Keep the hole brown as requested by name, but maybe styled better
  rasta: ['#ff0000', '#f1c40f', '#008000'] // Red, Yellow, Green
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Game State
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'level_transition' | 'won' | 'gameover'>('menu')
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(5) // Changed to 5 lives
  const [message, setMessage] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState(0)
  const [lostBall, setLostBall] = useState(false) // Visual cue for lost ball
  
  // Refs
  const ballsRef = useRef<Ball[]>([])
  const paddleRef = useRef<Paddle>({ x: 0, y: 0, width: 100, height: 15, color: COLORS.paddle })
  const bricksRef = useRef<Brick[]>([])
  const particlesRef = useRef<Particle[]>([])
  const powerUpsRef = useRef<PowerUp[]>([])
  const requestRef = useRef<number | null>(null)
  const characterImageRef = useRef<HTMLImageElement | null>(null)
  const holeRef = useRef<{x: number, y: number}>({ x: 0, y: 0 })
  
  // Canvas Size Management
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // --- Resize Handler ---
  const handleResize = useCallback(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current
      setCanvasSize({ width: clientWidth, height: clientHeight })
      
      // Update canvas dimensions immediately to avoid stretching
      if (canvasRef.current) {
        canvasRef.current.width = clientWidth
        canvasRef.current.height = clientHeight
      }
      
      // Reposition paddle if out of bounds
      if (paddleRef.current.x > clientWidth) {
        paddleRef.current.x = clientWidth / 2 - paddleRef.current.width / 2
      }
      
      // Reposition Hole
      // If playing, keep relative or just update
      if (gameState === 'playing') {
         // We might need to re-init bricks or scale positions, but for now let's just ensure hole is visible
         holeRef.current.x = Math.min(Math.max(holeRef.current.x, 50), clientWidth - 50)
      }
    }
  }, [gameState])

  useEffect(() => {
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [handleResize])

  // --- Game Logic ---

  const getBrickColor = (health: number) => {
    // Cycle through beautiful colors based on health
    return COLORS.brickColors[(health - 1) % COLORS.brickColors.length]
  }

  const resetBallAndPaddle = (currentLevel: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const speed = 4 + currentLevel * 0.5
    const direction = Math.random() > 0.5 ? 1 : -1
    
    ballsRef.current = [{
      x: canvas.width / 2,
      y: canvas.height - 100,
      dx: speed * direction,
      dy: -speed,
      radius: 12,
      image: characterImageRef.current
    }]
    
    paddleRef.current = {
      x: (canvas.width - 100) / 2,
      y: canvas.height - 40, // Higher up for mobile thumbs
      width: Math.max(60, 100 - (currentLevel * 5)),
      height: 15,
      color: COLORS.paddle
    }
    
    powerUpsRef.current = []
  }

  const initGame = (currentLevel: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    resetBallAndPaddle(currentLevel)

    // Randomize Hole Position
    const holeX = Math.random() * (canvas.width - 100) + 50
    holeRef.current = { x: holeX, y: 60 } // Lower y for visibility

    // Create Bricks - Fill the screen more
    const brickWidth = canvas.width < 500 ? 40 : 60
    const brickHeight = 25
    const brickPadding = 5
    const brickOffsetTop = 120
    const brickOffsetLeft = 10
    
    const brickColumnCount = Math.floor((canvas.width - 20) / (brickWidth + brickPadding))
    const brickRowCount = 6 + currentLevel

    const newBricks: Brick[] = []
    
    // Center the grid
    const totalRowWidth = brickColumnCount * (brickWidth + brickPadding) - brickPadding
    const startX = (canvas.width - totalRowWidth) / 2

    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        const x = startX + (c * (brickWidth + brickPadding))
        const y = (r * (brickHeight + brickPadding)) + brickOffsetTop

        const distToHole = Math.sqrt(Math.pow(x - holeRef.current.x, 2) + Math.pow(y - holeRef.current.y, 2))
        if (distToHole < 60) continue; // Don't spawn on hole

        // Determine brick type
        let type: 'normal' | 'unbreakable' = 'normal'
        let health = 1
        let maxHealth = 1

        if (r > 1 && Math.random() < 0.05) {
          type = 'unbreakable'
          health = 999
          maxHealth = 999
        } else {
          const rand = Math.random()
          if (currentLevel > 2 && rand < 0.2) health = 3
          else if (currentLevel > 1 && rand < 0.4) health = 2
          else if (currentLevel > 3 && rand < 0.1) health = 4
          else health = 1
          maxHealth = health
        }

        newBricks.push({
          x,
          y,
          width: brickWidth,
          height: brickHeight,
          status: 1,
          color: type === 'unbreakable' ? COLORS.unbreakable : getBrickColor(health),
          health,
          maxHealth,
          type
        })
      }
    }
    bricksRef.current = newBricks
  }

  // Load Character Image
  useEffect(() => {
    const img = new Image()
    img.src = CHARACTERS[selectedCharacter].image
    img.onload = () => {
      characterImageRef.current = img
      ballsRef.current.forEach(ball => ball.image = img)
    }
    img.onerror = () => { characterImageRef.current = null }
  }, [selectedCharacter])

  const startGame = () => {
    setGameState('playing')
    setScore(0)
    setLevel(1)
    setLives(5) // Start with 5 lives
    // Small timeout to ensure canvas size is ready
    setTimeout(() => initGame(1), 50)
  }

  const triggerLevelTransition = () => {
    setGameState('level_transition')
    // "Push it" meme moment
    setMessage("PUSH IT!")
    
    setTimeout(() => {
      setMessage('')
      if (level >= 5) {
        setGameState('won')
        confetti({ particleCount: 200, spread: 160, origin: { y: 0.6 } })
      } else {
        setLevel(prev => prev + 1)
        setGameState('playing')
        initGame(level + 1)
      }
    }, 3000) // 3 seconds of "Push it"
  }

  // --- Game Loop ---
  useEffect(() => {
    if (gameState !== 'playing') {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const update = () => {
      const paddle = paddleRef.current
      const bricks = bricksRef.current
      const hole = holeRef.current
      const powerUps = powerUpsRef.current

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw Hole
      ctx.beginPath()
      ctx.arc(hole.x, hole.y, 35, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.hole
      ctx.fill()
      ctx.strokeStyle = '#fbbf24' // Gold ring
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('BROWN HOLE', hole.x, hole.y + 5) // Updated text
      ctx.closePath()

      // Draw Bricks
      bricks.forEach(brick => {
        if (brick.status === 1) {
          ctx.beginPath()
          ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 4)
          ctx.fillStyle = brick.type === 'unbreakable' ? COLORS.unbreakable : getBrickColor(brick.health)
          ctx.fill()
          // Shine effect
          ctx.fillStyle = 'rgba(255,255,255,0.1)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(0,0,0,0.1)'
          ctx.stroke()
          
          if (brick.type !== 'unbreakable' && brick.health > 1) {
             ctx.fillStyle = 'rgba(255,255,255,0.8)'
             ctx.font = '10px Arial'
             ctx.fillText(brick.health.toString(), brick.x + brick.width/2, brick.y + brick.height/2 + 4)
          }
          ctx.closePath()
        }
      })

      // Draw Paddle
      ctx.beginPath()
      ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 8)
      ctx.fillStyle = paddle.color
      ctx.fill()
      ctx.shadowColor = 'rgba(0,0,0,0.2)'
      ctx.shadowBlur = 10
      ctx.shadowOffsetY = 5
      ctx.closePath()
      ctx.shadowColor = 'transparent' // Reset shadow

      // Draw PowerUps
      for (let i = powerUps.length - 1; i >= 0; i--) {
          const p = powerUps[i]
          p.y += p.dy
          
          ctx.beginPath()
          ctx.arc(p.x, p.y, 15, 0, Math.PI*2)
          ctx.fillStyle = p.type === 'blue_balls' ? '#3b82f6' : '#ffffff'
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.fillStyle = p.type === 'blue_balls' ? '#fff' : '#000'
          ctx.font = 'bold 10px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(p.type === 'blue_balls' ? 'BB' : 'JT', p.x, p.y + 4)
          ctx.closePath()

          // Collision PowerUp
          if (
              p.y + 15 >= paddle.y && 
              p.y - 15 <= paddle.y + paddle.height &&
              p.x >= paddle.x && 
              p.x <= paddle.x + paddle.width
          ) {
              // Activate
              const baseBall = ballsRef.current[0]
              if (baseBall) {
                const count = p.type === 'blue_balls' ? 1 : 2
                for(let k=0; k<count; k++) {
                    ballsRef.current.push({
                        x: baseBall.x,
                        y: baseBall.y,
                        dx: (Math.random() - 0.5) * 8,
                        dy: -Math.abs(baseBall.dy),
                        radius: baseBall.radius,
                        image: baseBall.image
                    })
                }
                setMessage(p.type === 'blue_balls' ? "Blue Balls!" : "Jizztime!")
                setTimeout(() => setMessage(''), 1500)
              }
              powerUps.splice(i, 1)
              continue
          }
          if (p.y > canvas.height) powerUps.splice(i, 1)
      }

      // Balls
      for (let i = ballsRef.current.length - 1; i >= 0; i--) {
          const ball = ballsRef.current[i]

          // Draw
          ctx.beginPath()
          if (ball.image) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(ball.image, ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2)
            ctx.restore()
          } else {
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
            ctx.fillStyle = CHARACTERS[selectedCharacter].color
            ctx.fill()
          }
          ctx.closePath()

          // Move
          ball.x += ball.dx
          ball.y += ball.dy

          // Hole Collision
          const distToHole = Math.sqrt(Math.pow(ball.x - hole.x, 2) + Math.pow(ball.y - hole.y, 2))
          if (distToHole < 35 + ball.radius) {
            triggerLevelTransition()
            return
          }

          // Wall Collision
          if (ball.x + ball.dx > canvas.width - ball.radius) {
            ball.x = canvas.width - ball.radius
            ball.dx = -ball.dx
          } else if (ball.x + ball.dx < ball.radius) {
            ball.x = ball.radius
            ball.dx = -ball.dx
          }
          
          if (ball.y + ball.dy < ball.radius) {
            ball.y = ball.radius
            ball.dy = -ball.dy
          } else if (ball.y + ball.dy > canvas.height - ball.radius) {
            // Paddle Hit
            if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
              const hitPoint = ball.x - (paddle.x + paddle.width / 2)
              const normalizedHit = hitPoint / (paddle.width / 2)
              ball.dy = -Math.abs(ball.dy)
              ball.dx = normalizedHit * 6
              ball.dx *= 1.02
              ball.dy *= 1.02
            } else {
              // Lost
              ballsRef.current.splice(i, 1)
              
              // Visual cue for lost ball
              setLostBall(true)
              setTimeout(() => setLostBall(false), 200)
              
              continue
            }
          }

          // Brick Collision
          bricks.forEach(brick => {
            if (brick.status === 1) {
              if (
                ball.x > brick.x &&
                ball.x < brick.x + brick.width &&
                ball.y > brick.y &&
                ball.y < brick.y + brick.height
              ) {
                ball.dy = -ball.dy
                
                if (brick.type !== 'unbreakable') {
                    brick.health -= 1
                    if (brick.health <= 0) {
                        brick.status = 0
                        setScore(prev => prev + 10)
                        
                        // Drop PowerUp
                        if (Math.random() < 0.15) {
                            const type = Math.random() > 0.5 ? 'blue_balls' : 'jizztime'
                            powerUpsRef.current.push({
                                x: brick.x + brick.width/2,
                                y: brick.y,
                                dy: 3,
                                type,
                                width: 30,
                                height: 30
                            })
                        }

                        // Motivation
                        if (Math.random() < 0.1) {
                          const msg = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)]
                          setMessage(msg)
                          setTimeout(() => setMessage(''), 2000)
                        }
                        
                        // Particles
                        for (let k = 0; k < 6; k++) {
                          particlesRef.current.push({
                            x: brick.x + brick.width / 2,
                            y: brick.y + brick.height / 2,
                            dx: (Math.random() - 0.5) * 6,
                            dy: (Math.random() - 0.5) * 6,
                            life: 1,
                            color: brick.color
                          })
                        }
                    } else {
                        brick.color = getBrickColor(brick.health)
                    }
                }
              }
            }
          })
      }

      // Lives check
      if (ballsRef.current.length === 0) {
          if (lives > 1) {
            setLives(prev => prev - 1)
            resetBallAndPaddle(level)
          } else {
            setGameState('gameover')
          }
          return
      }

      // Clear check
      if (bricks.filter(b => b.status === 1 && b.type !== 'unbreakable').length === 0) {
        triggerLevelTransition()
        return
      }

      // Particles
      particlesRef.current.forEach((p, index) => {
        p.x += p.dx
        p.y += p.dy
        p.life -= 0.04
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, 4, 4)
        ctx.globalAlpha = 1
        if (p.life <= 0) particlesRef.current.splice(index, 1)
      })

      requestRef.current = requestAnimationFrame(update)
    }

    requestRef.current = requestAnimationFrame(update)
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [gameState, level, selectedCharacter, lives])

  // Input Handling
  const handleMove = (clientX: number) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    if (x > 0 && x < rect.width) {
      paddleRef.current.x = x - paddleRef.current.width / 2
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX)
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX)
  }

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 w-full h-[100dvh] overflow-hidden flex flex-col items-center justify-center font-sans transition-colors duration-200 ${lostBall ? 'bg-red-900/50' : ''}`}
      style={{ background: lostBall ? undefined : COLORS.background }}
    >
      {/* Top Bar */}
      {gameState !== 'menu' && (
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center text-white font-bold z-10 pointer-events-none">
          <div className="flex gap-4 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full">
            <span>{score} pts</span>
            <span className="flex items-center gap-1"><Heart size={16} className="fill-red-500 text-red-500"/> {lives}</span>
          </div>
          <div className="bg-black/20 backdrop-blur-md px-4 py-2 rounded-full">
            Level {level}
          </div>
        </div>
      )}

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className={`block touch-none ${gameState === 'menu' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
      />

      {/* Yelling Guy Overlay */}
      {message && gameState !== 'level_transition' && (
        <div className="absolute top-0 left-0 z-30 pointer-events-none flex items-start animate-slide-in-left mt-16 ml-4">
           <img 
              src="/assets/yelling-guy.svg" 
              alt="Guy" 
              className="w-32 h-32 transform scale-x-[-1]" 
           />
           <div className="bg-white border-4 border-black p-4 rounded-2xl rounded-bl-none ml-[-10px] shadow-lg animate-bounce max-w-[200px]">
              <p className="text-xl font-black text-black leading-tight">{message}</p>
           </div>
        </div>
      )}

      {/* Push It Transition */}
      {gameState === 'level_transition' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-pulse">
           <div className="text-center mb-8">
             <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 drop-shadow-[0_5px_0_rgba(255,255,255,0.2)] animate-bounce mb-4">
               GIRL I WANT TO<br/>MAKE YOU SWEAT!
             </h1>
             <p className="text-3xl text-yellow-400 font-bold animate-pulse">
               A la la la la long...
             </p>
           </div>
           
           {/* Reggae/Sweat Vibe Animation */}
           <div className="relative w-64 h-64 flex items-center justify-center">
              <div className="absolute inset-0 border-8 border-green-500 rounded-full animate-spin-slow opacity-50"></div>
              <div className="absolute inset-4 border-8 border-yellow-500 rounded-full animate-spin-reverse opacity-50"></div>
              <div className="absolute inset-8 border-8 border-red-500 rounded-full animate-spin-slow opacity-50"></div>
              <div className="text-8xl">🥵</div>
           </div>

           <p className="text-white text-2xl mt-8 font-bold">Push it some more...</p>
        </div>
      )}

      {/* Menu Screen */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20 p-4">
          <h1 className="text-6xl md:text-8xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-500 drop-shadow-lg tracking-tighter text-center">
            BROWN<br/>HOLE
          </h1>
          <p className="text-xl mb-12 text-pink-200 tracking-widest uppercase font-bold">Pick Your Fighter</p>
          
          <div className="flex gap-6 md:gap-12 mb-16">
            {CHARACTERS.map((char, idx) => (
              <button
                key={char.name}
                onClick={() => setSelectedCharacter(idx)}
                className={`group relative p-4 rounded-3xl transition-all duration-300 transform hover:scale-110 border-4 ${
                  selectedCharacter === idx 
                      ? 'border-yellow-400 bg-white/10 shadow-[0_0_30px_rgba(250,204,21,0.5)] scale-110' 
                      : 'border-white/20 hover:border-white/50'
                }`}
              >
                <div className="w-28 h-28 md:w-40 md:h-40 rounded-full bg-white/10 mb-4 overflow-hidden relative border-4 border-white/20 group-hover:border-white/40">
                  <img src={char.image} alt={char.name} className="w-full h-full object-cover" />
                </div>
                <div className={`text-xl md:text-2xl font-bold text-center ${selectedCharacter === idx ? 'text-yellow-400' : 'text-white'}`}>
                  {char.name}
                </div>
              </button>
            ))}
          </div>
          
          <button
            onClick={startGame}
            className="w-full max-w-sm py-6 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-brown-900 rounded-full text-3xl font-black transition-all transform hover:scale-105 shadow-[0_10px_0_rgb(161,98,7)] active:shadow-none active:translate-y-[10px] flex items-center justify-center gap-4"
          >
            START GAME <Play size={32} className="fill-current" />
          </button>
        </div>
      )}

      {/* Game Over Screen - Redesigned */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white z-50 p-6">
          {/* Score in Middle (Top of content) */}
          <div className="flex flex-col items-center mb-8">
             <span className="text-2xl text-gray-400 uppercase tracking-widest mb-2">Final Score</span>
             <span className="text-8xl font-black text-yellow-400">{score}</span>
          </div>

          {/* Game Over below score */}
          <h2 className="text-5xl md:text-7xl font-black text-red-500 mb-16 tracking-tighter uppercase drop-shadow-[0_5px_0_rgba(150,0,0,0.5)]">
            GAME OVER
          </h2>

          {/* Try Again at Bottom */}
          <button
            onClick={() => setGameState('menu')}
            className="w-full max-w-xs py-6 bg-white text-black hover:bg-gray-200 rounded-full text-2xl font-bold transition-transform hover:scale-105 shadow-xl flex items-center justify-center gap-3"
          >
            <RotateCcw size={28} /> TRY AGAIN
          </button>
        </div>
      )}

      {/* Won Screen */}
      {gameState === 'won' && (
        <div className="absolute inset-0 bg-yellow-500 flex flex-col items-center justify-center text-white z-50 p-6">
          <Trophy size={96} className="mb-6 text-white animate-bounce" />
          <h2 className="text-6xl font-black mb-4 text-center">YOU CONQUERED<br/>THE HOLE!</h2>
          <p className="text-4xl mb-12 font-bold bg-black/20 px-8 py-4 rounded-full">Score: {score}</p>
          <button
            onClick={() => setGameState('menu')}
            className="w-full max-w-xs py-6 bg-white text-yellow-600 hover:bg-gray-50 rounded-full text-2xl font-bold transition-transform hover:scale-105 shadow-xl flex items-center justify-center gap-3"
          >
            <RotateCcw size={28} /> PLAY AGAIN
          </button>
        </div>
      )}
    </div>
  )
}
