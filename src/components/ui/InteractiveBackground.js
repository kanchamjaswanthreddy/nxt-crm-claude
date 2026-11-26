"use client";

import React, { useEffect, useRef } from 'react';

export default function InteractiveBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    // L-18: Respect prefers-reduced-motion — skip animation/rendering
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    const time = 0; // Fixed time for static curves

    // --- Static & Procedural Elements ---
    
    // 1. Bar Chart Silhouette (Right side - representing growth)
    let bars = [];
    const initBars = () => {
      bars = [];
      for (let i = 0; i < 24; i++) {
        // Heights following a growth curve
        const baseHeight = 50 + (i * 12); 
        bars.push(baseHeight + Math.sin(i * 0.5) * 40 + Math.random() * 30);
      }
    };

    // 2. Area Chart Silhouette (Left side - representing stability)
    let areaChart = [];
    const initAreaChart = () => {
      areaChart = [];
      for (let i = 0; i <= 20; i++) {
        areaChart.push({
          x: (width * 0.4 / 20) * i,
          y: height - (80 + Math.sin(i * 0.4) * 50 + i * 5)
        });
      }
    };

    const init = () => {
      initBars();
      initAreaChart();
    };

    init();

    // Helper: Draw 3D Orb
    const drawOrb = (x, y, radius, baseColor, lightColor) => {
      ctx.save();
      // Shadow
      ctx.shadowColor = 'rgba(0, 32, 91, 0.15)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 15;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      
      // Reset shadow for gradient
      ctx.shadowColor = 'transparent';
      
      const grad = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, radius * 0.1, 
        x, y, radius
      );
      grad.addColorStop(0, '#ffffff'); // bright highlight
      grad.addColorStop(0.3, lightColor);
      grad.addColorStop(1, baseColor);
      
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    };

    function render() {
      // Base pure white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 1. Draw Area Chart (Left)
      if (areaChart.length > 0) {
        ctx.beginPath();
        ctx.moveTo(areaChart[0].x, height);
        areaChart.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.lineTo(areaChart[areaChart.length - 1].x, height);
        ctx.closePath();
        
        const areaGrad = ctx.createLinearGradient(0, height - 200, 0, height);
        areaGrad.addColorStop(0, 'rgba(0, 32, 91, 0.05)'); // Very faint Navy
        areaGrad.addColorStop(1, 'rgba(0, 32, 91, 0)');
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // Area Chart Line
        ctx.beginPath();
        ctx.moveTo(areaChart[0].x, areaChart[0].y);
        areaChart.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.strokeStyle = 'rgba(0, 32, 91, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 2. Draw Bar Chart Silhouette (Right)
      const barW = Math.max(15, width * 0.02);
      const startX = width * 0.55;
      bars.forEach((h, i) => {
        const x = startX + i * (barW * 1.5);
        const y = height - h;
        const grad = ctx.createLinearGradient(x, y, x, height);
        
        // Use Gold for the highest bars to emphasize growth
        if (i > 18) {
          grad.addColorStop(0, 'rgba(212, 175, 55, 0.15)'); // Faint Gold
          grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
        } else {
          grad.addColorStop(0, 'rgba(150, 180, 220, 0.25)'); // Faint Silver/Blue
          grad.addColorStop(1, 'rgba(150, 180, 220, 0)');
        }
        
        ctx.fillStyle = grad;
        // Rounded top bars for modern look
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, [6, 6, 0, 0]);
        ctx.fill();
      });

      // 3. Draw Sweeping Growth Ribbons (Bottom Left to Top Right)
      ctx.save();
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-100, height * 0.8 + i * 20);
        ctx.bezierCurveTo(
          width * 0.3, height * 0.9,
          width * 0.6, height * 0.3,
          width + 100, height * 0.2 - i * 30 // Trending upwards
        );
        
        if (i % 2 === 0) {
          ctx.strokeStyle = `rgba(212, 175, 55, ${0.3 - i * 0.03})`; // Prominent Gold trend line
          ctx.lineWidth = i === 0 ? 3 : 1; // Thick primary trend line
        } else {
          ctx.strokeStyle = `rgba(0, 32, 91, ${0.15 - i * 0.02})`; // Navy accent
          ctx.lineWidth = 1;
        }
        ctx.stroke();
      }
      
      // Secondary Ribbons (Top Right Cascading Down)
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(width * 0.6 + i * 30, -100);
        ctx.bezierCurveTo(
          width * 0.75, height * 0.3,
          width * 0.9, height * 0.4,
          width + 100, height * 0.6 + i * 40
        );
        ctx.strokeStyle = `rgba(160, 190, 230, ${0.12 - i * 0.01})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      // 4. Draw Concentric Rings (Top Right Filler)
      ctx.save();
      const ringX = width * 0.85;
      const ringY = height * 0.15;
      
      // Outer faint ring
      ctx.beginPath();
      ctx.arc(ringX, ringY, 80, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 32, 91, 0.03)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Inner dashed/dotted ring
      ctx.beginPath();
      ctx.arc(ringX, ringY, 60, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.1)';
      ctx.setLineDash([4, 8]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Small solid ring
      ctx.beginPath();
      ctx.arc(ringX, ringY, 20, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 32, 91, 0.05)';
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();

      // Top Left Filler rings
      ctx.save();
      const ringX2 = width * 0.1;
      const ringY2 = height * 0.15;
      
      ctx.beginPath();
      ctx.arc(ringX2, ringY2, 100, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 32, 91, 0.02)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ringX2, ringY2, 60, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150, 180, 220, 0.15)';
      ctx.setLineDash([2, 6]);
      ctx.stroke();
      ctx.restore();

      // Middle Left CRM Trend Graph
      ctx.save();
      const trendX = width * 0.08;
      const trendY = height * 0.45;
      
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        // Stagger the lines for a dynamic look
        const yOffset = i * 40;
        ctx.moveTo(trendX, trendY + yOffset);
        ctx.lineTo(trendX + 60, trendY - 30 + yOffset * 0.8);
        ctx.lineTo(trendX + 140, trendY + 20 + yOffset * 0.9);
        ctx.lineTo(trendX + 220, trendY - 50 + yOffset);
        
        ctx.strokeStyle = i === 1 ? 'rgba(212, 175, 55, 0.2)' : 'rgba(0, 32, 91, 0.08)';
        ctx.lineWidth = i === 1 ? 2 : 1;
        ctx.stroke();
        
        // Data nodes (circles on the joints)
        const points = [
          {x: trendX, y: trendY + yOffset},
          {x: trendX + 60, y: trendY - 30 + yOffset * 0.8},
          {x: trendX + 140, y: trendY + 20 + yOffset * 0.9},
          {x: trendX + 220, y: trendY - 50 + yOffset}
        ];
        
        points.forEach(pt => {
           ctx.beginPath();
           ctx.arc(pt.x, pt.y, 4, 0, Math.PI*2);
           ctx.fillStyle = '#ffffff';
           ctx.fill();
           ctx.lineWidth = 1.5;
           ctx.strokeStyle = i === 1 ? 'rgba(212, 175, 55, 0.4)' : 'rgba(0, 32, 91, 0.2)';
           ctx.stroke();
        });
      }
      ctx.restore();

      // 5. Draw 3D Orbs
      // Top left orb (Silver/White)
      drawOrb(width * 0.15, height * 0.15, 20, '#dbe2ec', '#f0f4f8');
      
      // Bottom left orb (Silver/White)
      drawOrb(width * 0.15, height * 0.85, 30, '#dbe2ec', '#f0f4f8');
      
      // Bottom right orb (Blue/Pearl)
      drawOrb(width * 0.85, height * 0.8, 50, '#a5bde3', '#e4edf7');
      
      // Top right small orb (Gold accent) - slightly larger to fill space
      drawOrb(width * 0.78, height * 0.22, 22, '#e8c86b', '#fcf6e3');
    }

    render();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      init();
      render(); // Redraw on resize
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        background: '#ffffff'
      }}
    />
  );
}
