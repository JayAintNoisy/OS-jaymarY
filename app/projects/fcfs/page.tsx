"use client";

import React, { useState } from "react";
import Link from "next/link"; // Link is not used but kept in imports list for completeness if future navigation is added

const MAX_TIME_UNIT = 500;

// --- THEME CONFIGURATION (Prioritizing Cyan/Blue to match portfolio) ---
const BACKGROUND_COLOR = "bg-[#0a0c20]"; // Darkest Blue/Purple (Main Background)
const CARD_BG_COLOR = "bg-[#1a1e3a]";   // Dark blue-purple (Card/Section Background)
const INPUT_BG_COLOR = "bg-[#0a0c20]"; // Darkest background for inputs

// Primary Accent: Vibrant Blue/Cyan (Matching the portfolio's main highlight color)
const PRIMARY_CYAN_CLASS = "text-[#3b82f6]"; 
const PRIMARY_BG_CYAN = "bg-[#3b82f6]";
const PRIMARY_HOVER_CYAN_BG = "hover:bg-[#5b9bff]";

// Secondary Accent: Vibrant Red/Pink (Used for contrast/action/specific metrics)
const SECONDARY_RED_CLASS = "text-[#E73C58]"; 
const SECONDARY_BG_RED = "bg-[#E73C58]";
const SECONDARY_HOVER_RED_BG = "hover:bg-[#F07388]";

const BORDER_COLOR = "border-[#3b82f6]/30"; // Softened border for sections

// Interfaces remain the same for type safety
interface Process {
  pid: string;
  arrival: number | "";
  burst: number | "";
}

interface ProcessResult extends Omit<Process, "arrival" | "burst"> {
  arrival: number;
  burst: number;
  completion: number;
  waiting: number;
  turnaround: number;
  remaining?: number;
}

interface GanttBlock {
  process: string | "IDLE";
  start: number;
  end: number;
}
interface GanttData {
    ganttBlocks: GanttBlock[];
    timeMarkers: number[];
    totalTime: number;
}


const DEFAULT_PROCESS_DATA: Omit<Process, "pid"> = { arrival: "", burst: "" };

const getInitialProcesses = () => [
  { pid: "P1", ...DEFAULT_PROCESS_DATA },
  { pid: "P2", ...DEFAULT_PROCESS_DATA },
  { pid: "P3", ...DEFAULT_PROCESS_DATA },
  { pid: "P4", ...DEFAULT_PROCESS_DATA },
  { pid: "P5", ...DEFAULT_PROCESS_DATA },
];

// --- FCFS Logic (MODIFIED to return structured Gantt data) ---
function fcfs(processes: { pid: string; arrival: number; burst: number }[]) {
  const procs = processes
    .map((p) => ({ ...p }))
    .sort((a, b) => a.arrival - b.arrival || a.pid.localeCompare(b.pid));

  const done: ProcessResult[] = [];
  let time = 0;
  const uncompressedTimeline: (string | "IDLE")[] = [];

  for (const current of procs) {
    let startTime = time;

    // 1. Check for IDLE time
    if (current.arrival > time) {
      const idleDuration = current.arrival - time;
      for (let i = 0; i < idleDuration; i++) {
        uncompressedTimeline.push("IDLE");
      }
      startTime = current.arrival;
    }

    // 2. Process Execution
    const completionTime = startTime + current.burst;
    for (let i = 0; i < current.burst; i++) {
      uncompressedTimeline.push(current.pid);
    }

    // 3. Update time and record results
    time = completionTime;

    done.push({
      ...current,
      completion: completionTime,
      turnaround: completionTime - current.arrival,
      waiting: completionTime - current.arrival - current.burst,
    });
  }

  // Generate structured Gantt Blocks from the uncompressed timeline
  const ganttBlocks: GanttBlock[] = [];
  let blockStart = 0;
  for (let t = 0; t < uncompressedTimeline.length; t++) {
      const currentProcess = uncompressedTimeline[t];

      if (t === uncompressedTimeline.length - 1 || uncompressedTimeline[t + 1] !== currentProcess) {
          ganttBlocks.push({
              process: currentProcess,
              start: blockStart,
              end: t + 1,
          });
          blockStart = t + 1;
      }
  }
  
  // Generate time markers
  const timeMarkers = Array.from(new Set(ganttBlocks.map(b => b.start).concat(ganttBlocks.map(b => b.end)))).sort((a, b) => a - b);
  const totalTime = timeMarkers[timeMarkers.length - 1] || 0;

  return { 
      ganttBlocks, 
      timeMarkers,
      totalTime,
      results: done 
  };
}

export default function FCFSSimulator() {
  const [processes, setProcesses] = useState<Process[]>(getInitialProcesses());
  const [results, setResults] = useState<ProcessResult[] | null>(null);
  const [ganttData, setGanttData] = useState<GanttData | null>(null); // State for structured Gantt data
  const [error, setError] = useState("");

  const updateField = (i: number, field: keyof Process, value: string) => {
    const updated = [...processes];
    setError("");

    if (field === "pid") {
      updated[i].pid = value;
    } else {
      // Ensure only non-negative integers are entered
      if (!/^\d*$/.test(value)) return;
      updated[i][field] = value === "" ? "" : parseInt(value);
    }

    setProcesses(updated);
  };

  const addProcess = () => {
    setProcesses([
      ...processes,
      { pid: `P${processes.length + 1}`, arrival: "", burst: "" },
    ]);
    setResults(null);
    setGanttData(null);
  };

  const removeProcess = (i: number) => {
    const copy = [...processes];
    copy.splice(i, 1);

    const renumbered = copy.map((p, index) => ({ ...p, pid: `P${index + 1}` }));
    setProcesses(renumbered);
    setResults(null);
    setGanttData(null);
    setError("");
  };

  const resetProcesses = () => {
    setProcesses(getInitialProcesses());
    setResults(null);
    setGanttData(null);
    setError("");
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    i: number,
    field: "arrival" | "burst"
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();

      // Find the next input field to focus on
      let nextElement: HTMLElement | null = null;
      if (field === 'arrival') {
        nextElement = document.getElementById(`burst-${processes[i].pid}`);
      } else if (field === 'burst') {
        const nextProcess = processes[i + 1];
        if (nextProcess) {
          nextElement = document.getElementById(`arrival-${nextProcess.pid}`);
        }
      }

      if (nextElement) {
        nextElement.focus();
      } else if (i === processes.length - 1) {
        document.getElementById("simulate-button")?.focus();
      }
    }
  };

  const simulate = () => {
    setError("");
    setResults(null);
    setGanttData(null);

    const validProcesses: { pid: string; arrival: number; burst: number }[] =
      [];

    for (const p of processes) {
      if (!p.pid.trim()) {
        return setError("PID cannot be empty for any process.");
      }

      if (p.arrival === "" && p.burst === "") {
        continue;
      }

      if (p.arrival === "" || p.burst === "") {
        return setError(
          `Process ${p.pid}: Arrival Time and Burst Time must both be filled.`
        );
      }

      const arrival = Number(p.arrival);
      const burst = Number(p.burst);

      if (isNaN(arrival) || isNaN(burst)) {
        return setError(
          `Process ${p.pid}: Arrival Time and Burst Time must be valid numbers.`
        );
      }

      if (arrival < 0 || burst <= 0) {
        return setError(
          `Process ${p.pid}: Arrival Time must be ≥ 0 and Burst Time must be ≥ 1.`
        );
      }
      if (arrival > MAX_TIME_UNIT || burst > MAX_TIME_UNIT) {
        return setError(
          `Process ${p.pid}: Value too large. Times must be ≤ ${MAX_TIME_UNIT}.`
        );
      }

      validProcesses.push({ pid: p.pid, arrival, burst });
    }

    if (validProcesses.length === 0) {
      return setError("Please define at least one process.");
    }

    const out = fcfs(validProcesses);

    setResults(out.results.sort((a, b) => a.pid.localeCompare(b.pid)));
    setGanttData({
        ganttBlocks: out.ganttBlocks,
        timeMarkers: out.timeMarkers,
        totalTime: out.totalTime,
    });
  };

  let avgW = 0,
    avgT = 0;

  if (results && results.length > 0) {
    avgW = results.reduce((a, b) => a + b.waiting, 0) / results.length;
    avgT = results.reduce((a, b) => a + b.turnaround, 0) / results.length;
  }

  return (
    <main className={`min-h-screen text-white font-sans p-4 md:p-8 ${BACKGROUND_COLOR}`}>
      
      {/* Header/Title Section */}
      <div className="flex items-center border-b border-gray-700 pb-4 mb-10 max-w-4xl mx-auto">
        <h1 className={`text-4xl font-extrabold text-center md:text-left ${PRIMARY_CYAN_CLASS} drop-shadow-lg`}>
          FCFS Scheduling Simulator
        </h1>
      </div>

      <section className="max-w-4xl mx-auto">
        
        {/* Input Parameters Section */}
        <div className={`mb-10 p-6 md:p-8 ${BORDER_COLOR} border ${CARD_BG_COLOR} shadow-2xl rounded-2xl`}>
          <h2 className="text-2xl font-bold mb-5 flex items-center">
             <span className={`${PRIMARY_CYAN_CLASS} mr-3 text-3xl`}>⚙️</span> Input Parameters
          </h2>

          <div className="mb-6 pb-4 border-b border-gray-700">
            <p className={`text-base font-semibold ${PRIMARY_CYAN_CLASS}`}>
              Algorithm: First Come, First Served (FCFS)
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Max Time Unit: {MAX_TIME_UNIT}. FCFS is inherently non-preemptive.
            </p>
          </div>

          {error && (
            <div className="border border-red-500 bg-red-900/50 p-4 mb-4 rounded-xl">
              <p className="text-red-400 font-bold">🚨 {error}</p>
            </div>
          )}

          {/* Process Input Table */}
          <div className="overflow-x-auto rounded-xl">
            <table className="min-w-full border-collapse rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-gray-700/50">
                  <th className="p-4 border border-gray-600 w-[20%] min-w-[70px] text-left">
                    PID
                  </th>
                  <th className="p-4 border border-gray-600 w-[30%]">
                    Arrival Time (ms)
                  </th>
                  <th className="p-4 border border-gray-600 w-[30%]">
                    Burst Time (ms)
                  </th>
                  <th className="p-4 border border-gray-600 w-[20%]">Action</th>
                </tr>
              </thead>

              <tbody>
                {processes.map((p, i) => (
                  <tr key={i} className={`bg-transparent border-t border-gray-700 hover:${CARD_BG_COLOR}/70 transition-colors`}>
                    {/* PID */}
                    <td className="p-3 border-r border-gray-700 text-left min-w-[70px]">
                      <span className={`px-3 py-1 inline-block font-mono font-bold ${PRIMARY_CYAN_CLASS} ${INPUT_BG_COLOR.replace('bg-', 'bg-')}/70 rounded-lg`}>
                        {p.pid}
                      </span>
                    </td>

                    {/* Arrival Time */}
                    <td className="p-3 border-r border-gray-700 text-center">
                      <input
                        type="text"
                        id={`arrival-${p.pid}`}
                        value={p.arrival}
                        onChange={(e) =>
                          updateField(i, "arrival", e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, i, "arrival")}
                        className={`w-full text-center border border-gray-600 p-2 font-mono focus:border-[#E73C58] ${INPUT_BG_COLOR} text-white rounded-lg outline-none transition-colors`}
                        placeholder="e.g., 0"
                        maxLength={MAX_TIME_UNIT.toString().length}
                      />
                    </td>

                    {/* Burst Time */}
                    <td className="p-3 border-r border-gray-700 text-center">
                      <input
                        type="text"
                        id={`burst-${p.pid}`}
                        value={p.burst}
                        onChange={(e) => updateField(i, "burst", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i, "burst")}
                        className={`w-full text-center border border-gray-600 p-2 font-mono focus:border-[#E73C58] ${INPUT_BG_COLOR} text-white rounded-lg outline-none transition-colors`}
                        placeholder="e.g., 5"
                        maxLength={MAX_TIME_UNIT.toString().length}
                      />
                    </td>

                    {/* Action */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => removeProcess(i)}
                        className={`bg-red-700 hover:bg-red-800 text-white text-sm py-2 px-4 rounded-lg transition duration-150 shadow-md ${processes.length <= 1 ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={processes.length <= 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <button
              onClick={simulate}
              id="simulate-button"
              className={`${PRIMARY_BG_CYAN} ${PRIMARY_HOVER_CYAN_BG} text-white font-extrabold w-full sm:w-auto py-3 px-8 rounded-full shadow-2xl transition duration-150 transform hover:scale-[1.02] active:scale-[0.98]`}
            >
              🚀 RUN SIMULATION
            </button>

            <div className="flex space-x-4 w-full sm:w-auto justify-end">
              <button
                id="add-process-button"
                onClick={addProcess}
                className={`border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6]/10 py-2 px-4 rounded-lg shadow-md transition duration-150 ${CARD_BG_COLOR} font-semibold`}
              >
                + Add Process
              </button>
              <button
                onClick={resetProcesses}
                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg shadow-md transition duration-150 font-semibold"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {results && ganttData && (
          <div className="mt-10">
            <SimulationOutput
              results={results}
              ganttData={ganttData}
              avgW={avgW}
              avgT={avgT}
            />
          </div>
        )}
      </section>
      
      {/* Footer */}
      <footer className="border-t border-gray-800 pt-6 mt-16 text-center text-sm text-gray-500">
        <p>
          &copy; {new Date().getFullYear()} **JAYMAR YECYEC**. All rights
          reserved.
        </p>
        <p className="mt-1">A First-Come, First-Served (FCFS) CPU Scheduling Simulator.</p>
      </footer>
    </main>
  );
}

// Separate component for Simulation Output to keep the main component cleaner
interface OutputProps {
  results: ProcessResult[];
  ganttData: GanttData;
  avgW: number;
  avgT: number;
}

function getProcessColor(pid: string | "IDLE"): string {
    if (pid === "IDLE") return "bg-gray-800 text-gray-400";
    
    // Consistent color mapping based on PID index
    const index = parseInt(pid.replace('P', '')) % 6;
    switch (index) {
        case 1: return "bg-blue-600 text-white";
        case 2: return "bg-green-600 text-white";
        case 3: return "bg-purple-600 text-white";
        case 4: return "bg-yellow-500 text-gray-900"; // Slightly brighter yellow for better contrast
        case 5: return "bg-pink-600 text-white";
        default: return "bg-teal-600 text-white";
    }
}

function SimulationOutput({ results, ganttData, avgW, avgT }: OutputProps) {
    const { ganttBlocks, timeMarkers, totalTime } = ganttData;

    // Use the same consistent card styling and new accent strategy
    const BACKGROUND_COLOR = "bg-[#0a0c20]";
    const CARD_BG_COLOR = "bg-[#1a1e3a]";
    const PRIMARY_CYAN_CLASS = "text-[#3b82f6]"; 
    const SECONDARY_RED_CLASS = "text-[#E73C58]"; 
    const SECONDARY_BG_RED = "bg-[#E73C58]";
    const PRIMARY_BG_CYAN = "bg-[#3b82f6]";
    const BORDER_COLOR = "border-[#3b82f6]/30"; 

    return (
      <section className={`p-6 md:p-8 ${BORDER_COLOR} border ${CARD_BG_COLOR} shadow-2xl rounded-2xl`}>
        <div className="flex items-center border-b border-gray-700 pb-4 mb-6">
          <h2 className={`text-2xl font-bold ${PRIMARY_CYAN_CLASS} flex items-center`}>
            <span className="mr-3 text-3xl">📊</span> Simulation Output
          </h2>
        </div>

        {/* Gantt Chart/Timeline */}
        {ganttBlocks.length > 0 && (
          <>
            <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
                <span className={`text-2xl mr-3 ${PRIMARY_CYAN_CLASS}`}>⏱️</span> Gantt Chart (CPU Timeline)
            </h3>
            
            {/* The Gantt Chart Container */}
            <div className={`p-4 mb-8 border border-gray-700 rounded-xl ${BACKGROUND_COLOR} overflow-x-auto shadow-inner`}>
                <div className="relative" style={{ minWidth: `${Math.max(400, totalTime * 40)}px` }}>
                    <div 
                        className="flex w-full rounded-lg overflow-hidden border border-gray-700" 
                        style={{ height: '60px' }}
                    >
                        {ganttBlocks.map((block, index) => {
                            const duration = block.end - block.start;
                            // Width calculation based on fixed unit size for better consistency in overflow mode
                            const widthPx = duration * 40; 
                            const blockColorClass = getProcessColor(block.process);

                            return (
                                <div 
                                    key={index} 
                                    className={`h-full flex items-center justify-center border-r border-gray-800 transition-all duration-300 ${blockColorClass} shadow-inner`}
                                    style={{ width: `${widthPx}px` }}
                                    title={`${block.process} (${duration}ms)`}
                                >
                                    <span className="text-sm font-extrabold p-1 select-none whitespace-nowrap">
                                        {block.process}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    
                    {/* Time Markers */}
                    <div className="relative w-full h-4 mt-2">
                        {timeMarkers.map((time, index) => {
                            // Calculate position based on fixed pixel width
                            const positionPx = time * 40; 
                            return (
                                <div 
                                    key={index} 
                                    className="absolute top-0 text-xs text-gray-400 transform -translate-x-1/2" 
                                    style={{ left: `${positionPx}px` }}
                                >
                                    <span className={`h-2 w-px inline-block ${PRIMARY_CYAN_CLASS} absolute bottom-full left-1/2 -translate-x-1/2`}></span>
                                    {time}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <p className="mt-8 text-gray-500 italic text-sm">
                    Execution Order (by FCFS rule: Arrival Time, then PID): {results.map(r => r.pid).join(" → ")}
                </p>
          </div>
          </>
        )}
        <hr className="border-gray-800 my-8" />

        {/* Process Metrics Table */}
        <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
            <span className={`text-2xl mr-3 ${PRIMARY_CYAN_CLASS}`}>📋</span> Process Metrics
        </h3>

        <div className="overflow-x-auto rounded-xl">
          <table className="min-w-full border-collapse border border-gray-700 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-gray-700/50">
                <th className="p-4 border border-gray-600">P</th>
                <th className="p-4 border border-gray-600">Arrival</th>
                <th className="p-4 border border-gray-600">Burst</th>
                <th className="p-4 border border-gray-600">Completion</th>
                
                {/* Turnaround column header: Secondary Red */}
                <th className={`p-4 border border-gray-600 ${SECONDARY_BG_RED} text-white`}>
                  Turnaround
                </th>
                
                {/* Waiting column header: Primary Cyan */}
                <th className={`p-4 border border-gray-600 ${PRIMARY_BG_CYAN} text-gray-900`}>
                  Waiting
                </th>
              </tr>
            </thead>

            <tbody>
              {results.map((p) => (
                <tr key={p.pid} className={`${CARD_BG_COLOR} border-t border-gray-700 hover:bg-gray-700/70 transition-colors`}>
                  <td className="p-3 border border-gray-700 text-center font-bold text-lg">
                    {p.pid}
                  </td>
                  <td className="p-3 border border-gray-700 text-center text-gray-300 font-mono">
                    {p.arrival}
                  </td>
                  <td className="p-3 border border-gray-700 text-center text-gray-300 font-mono">
                    {p.burst}
                  </td>
                  <td className="p-3 border border-gray-700 text-center text-gray-300 font-mono">
                    {p.completion}
                  </td>
                  
                  {/* Turnaround data: Secondary Red highlight */}
                  <td className="p-3 border border-gray-700 text-center bg-[#E73C58]/30 text-[#F07388] font-extrabold">
                    {avgT === 0 ? p.turnaround : p.turnaround.toFixed(2)}
                  </td>
                  
                  {/* Waiting data: Primary Cyan highlight */}
                  <td className="p-3 border border-gray-700 text-center bg-[#3b82f6]/30 text-[#7bb9ff] font-extrabold">
                    {avgW === 0 ? p.waiting : p.waiting.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 p-5 border ${BORDER_COLOR} bg-gray-900/40 rounded-xl flex flex-col sm:flex-row justify-around text-lg font-bold space-y-3 sm:space-y-0 shadow-lg">
          <p className="text-gray-300">
            Avg Waiting Time:{" "}
            <span className={`${PRIMARY_CYAN_CLASS} font-extrabold text-xl`}>{avgW.toFixed(2)} ms</span>
          </p>
          <p className="text-gray-300">
            Avg Turnaround Time:{" "}
            <span className={`${SECONDARY_RED_CLASS} font-extrabold text-xl`}>{avgT.toFixed(2)} ms</span>
          </p>
        </div>
      </section>
    );
}