import React, { useEffect, useRef, useState } from 'react';

function Home() {
    const canvasRef = useRef(null);
    const layoutWidth = 1000;
    const layoutHeight = 500;
    const boxSize = 4;

    const [selectedBoxes, setSelectedBoxes] = useState([]);
    const [previewBoxes, setPreviewBoxes] = useState([]);
    const [startPoint, setStartPoint] = useState(null);
    const isDragging = useRef(false);
    const lastDrawnBox = useRef(null);
    const [tool, setTool] = useState("pencil");

    const [history, setHistory] = useState([]); // ✅ Undo history

    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };

    const updatePreviewDebounced = useRef(debounce((tool, start, end) => {
        if (tool === "circle") {
            setPreviewBoxes(calculateBoxesInCircle(start, end));
        } else if (tool === "rectangle") {
            setPreviewBoxes(calculateBoxesInRectangle(start, end));
        } else if (tool === "triangle") {
            setPreviewBoxes(calculateBoxesInTriangle(start, end));
        }
    }, 10));

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = layoutWidth;
        canvas.height = layoutHeight;
        drawGrid(ctx, selectedBoxes, previewBoxes);
    }, [selectedBoxes, previewBoxes]);

    const drawGrid = (ctx, selected, preview) => {
        ctx.clearRect(0, 0, layoutWidth, layoutHeight);

        const cellMap = new Map();
        selected.forEach(b => {
            cellMap.set(`${b.row}-${b.col}`, 'lightblue');
        });
        preview.forEach(b => {
            if (!cellMap.has(`${b.row}-${b.col}`)) {
                cellMap.set(`${b.row}-${b.col}`, 'lightgreen');
            }
        });

        for (const [key, color] of cellMap.entries()) {
            const [row, col] = key.split('-').map(Number);
            const x = col * boxSize;
            const y = row * boxSize;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, boxSize, boxSize);
            ctx.strokeStyle = 'blue';
            ctx.strokeRect(x + 0.05, y + 0.05, boxSize - 0.1, boxSize - 0.1);
        }
    };

    const getBoxCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const col = Math.floor(x / boxSize);
        const row = Math.floor(y / boxSize);
        return { row, col };
    };

    const addBoxToSelection = (boxes) => {
        setSelectedBoxes(prev => {
            const set = new Set(prev.map(b => `${b.row}-${b.col}`));
            const newBoxes = boxes.filter(box => !set.has(`${box.row}-${box.col}`));
            const updated = [...prev, ...newBoxes];

            if (newBoxes.length > 0) {
                setHistory(h => [...h, prev]); // ✅ Save previous state
            }

            return updated;
        });
    };

    const calculateBoxesInCircle = (start, end) => {
        const centerX = (start.col + end.col) / 2;
        const centerY = (start.row + end.row) / 2;
        const radius = Math.sqrt(Math.pow(end.col - centerX, 2) + Math.pow(end.row - centerY, 2));
        const result = [];
        const rStart = Math.floor(centerY - radius);
        const rEnd = Math.ceil(centerY + radius);
        const cStart = Math.floor(centerX - radius);
        const cEnd = Math.ceil(centerX + radius);

        for (let r = rStart; r <= rEnd; r++) {
            for (let c = cStart; c <= cEnd; c++) {
                const distance = Math.sqrt(Math.pow(c - centerX, 2) + Math.pow(r - centerY, 2));
                if (distance <= radius && r >= 0 && c >= 0 && r < layoutHeight / boxSize && c < layoutWidth / boxSize) {
                    result.push({ row: r, col: c });
                }
            }
        }
        return result;
    };

    const calculateBoxesInRectangle = (start, end) => {
        const top = Math.min(start.row, end.row);
        const bottom = Math.max(start.row, end.row);
        const left = Math.min(start.col, end.col);
        const right = Math.max(start.col, end.col);

        const result = [];
        for (let r = top; r <= bottom; r++) {
            for (let c = left; c <= right; c++) {
                result.push({ row: r, col: c });
            }
        }
        return result;
    };

    const calculateBoxesInTriangle = (start, end) => {
        const result = [];
        const baseLeft = { x: start.col - Math.abs(end.col - start.col), y: start.row };
        const baseRight = { x: start.col + Math.abs(end.col - start.col), y: start.row };
        const apex = { x: end.col, y: end.row };

        const minRow = Math.max(0, Math.min(baseLeft.y, baseRight.y, apex.y));
        const maxRow = Math.min(layoutHeight / boxSize - 1, Math.max(baseLeft.y, baseRight.y, apex.y));
        const minCol = Math.max(0, Math.min(baseLeft.x, baseRight.x, apex.x));
        const maxCol = Math.min(layoutWidth / boxSize - 1, Math.max(baseLeft.x, baseRight.x, apex.x));

        const maxPoints = 3000;
        const estimated = (maxRow - minRow + 1) * (maxCol - minCol + 1);
        if (estimated > maxPoints) return [];

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (pointInTriangle({ x: c, y: r }, baseLeft, baseRight, apex)) {
                    result.push({ row: r, col: c });
                }
            }
        }
        return result;
    };

    const pointInTriangle = (p, a, b, c) => {
        const area = (v1, v2, v3) => (
            Math.abs((v1.x * (v2.y - v3.y) +
                v2.x * (v3.y - v1.y) +
                v3.x * (v1.y - v2.y)) / 2.0)
        );
        const A = area(a, b, c);
        const A1 = area(p, b, c);
        const A2 = area(a, p, c);
        const A3 = area(a, b, p);
        return Math.abs(A - (A1 + A2 + A3)) < 0.5;
    };

    const handleMouseDown = (e) => {
        isDragging.current = true;
        const start = getBoxCoords(e);
        setStartPoint(start);
        lastDrawnBox.current = null;

        if (tool === "pencil") {
            addBoxToSelection([start]);
            lastDrawnBox.current = start;
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current || !startPoint) return;
        const end = getBoxCoords(e);

        if (tool === "pencil") {
            if (
                !lastDrawnBox.current ||
                lastDrawnBox.current.row !== end.row ||
                lastDrawnBox.current.col !== end.col
            ) {
                lastDrawnBox.current = end;
                setSelectedBoxes(prev => {
                    const exists = prev.some(b => b.row === end.row && b.col === end.col);
                    if (!exists) {
                        const newSelected = [...prev, end];
                        const ctx = canvasRef.current.getContext('2d');
                        drawGrid(ctx, newSelected, []);
                        setHistory(h => [...h, prev]); // ✅ Store previous for pencil too
                        return newSelected;
                    }
                    return prev;
                });
            }
        } else {
            updatePreviewDebounced.current(tool, startPoint, end);
        }
    };

    const handleMouseUp = (e) => {
        isDragging.current = false;
        lastDrawnBox.current = null;

        if (!startPoint) return;
        const end = getBoxCoords(e);

        if (tool === "circle") {
            addBoxToSelection(calculateBoxesInCircle(startPoint, end));
        } else if (tool === "rectangle") {
            addBoxToSelection(calculateBoxesInRectangle(startPoint, end));
        } else if (tool === "triangle") {
            addBoxToSelection(calculateBoxesInTriangle(startPoint, end));
        }

        setStartPoint(null);
        setPreviewBoxes([]);
    };

    const handleUndo = () => {
        setHistory(prevHistory => {
            if (prevHistory.length === 0) return prevHistory;
            const newHistory = [...prevHistory];
            const last = newHistory.pop();
            setSelectedBoxes(last || []);
            return newHistory;
        });
    };

    const clearSelection = () => {
        setSelectedBoxes([]);
        setHistory([]); // ✅ Clear history as well
    };

    return (
        <div style={{ margin: '50px' }}>
            <div style={{ marginBottom: '10px' }}>
                <button onClick={() => setTool("pencil")} style={{ marginRight: '10px', backgroundColor: tool === "pencil" ? "#ccc" : "" }}>✏️ Pencil</button>
                <button onClick={() => setTool("circle")} style={{ marginRight: '10px', backgroundColor: tool === "circle" ? "#ccc" : "" }}>⚪ Circle</button>
                <button onClick={() => setTool("rectangle")} style={{ marginRight: '10px', backgroundColor: tool === "rectangle" ? "#ccc" : "" }}>▭ Rectangle</button>
                <button onClick={() => setTool("triangle")} style={{ marginRight: '10px', backgroundColor: tool === "triangle" ? "#ccc" : "" }}>🔺 Triangle</button>
                <button onClick={clearSelection}>🧹 Clear</button>
                <button onClick={handleUndo} style={{ marginLeft: '10px' }}>↩️ Undo</button>
            </div>

            <div style={{ position: "relative", width: layoutWidth, height: layoutHeight }}>
                <img
                    src="/images/img.png"
                    alt="Background"
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        zIndex: 1,
                    }}
                />
                <canvas
                    ref={canvasRef}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        zIndex: 3,
                        backgroundColor: "transparent",
                        border: '1px solid black',
                        cursor: 'crosshair',
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />
            </div>

            <div style={{ marginTop: '20px' }}>
                <h4>Selected Boxes:</h4>
                <ul>
                    {selectedBoxes.map((box, index) => (
                        <li key={index}>Row: {box.row}, Col: {box.col}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default Home;
