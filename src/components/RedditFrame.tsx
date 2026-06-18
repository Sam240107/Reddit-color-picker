import React, { useState } from "react";
import { MessageSquare, Share2, MoreHorizontal, Sun, Moon, Volume2, VolumeX, ShieldAlert, BadgeInfo } from "lucide-react";
import { CommentEntry } from "../types";

interface RedditFrameProps {
  children: React.ReactNode;
  comments: CommentEntry[];
  onAddComment: (text: string) => void;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  userScoreText: string | null;
}

export default function RedditFrame({
  children,
  comments,
  onAddComment,
  isSoundEnabled,
  onToggleSound,
  userScoreText,
}: RedditFrameProps) {
  const [commentInput, setCommentInput] = useState("");
  const [upvotes, setUpvotes] = useState(1420);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [hasDownvoted, setHasDownvoted] = useState(false);

  const handleUpvote = () => {
    if (hasUpvoted) {
      setUpvotes((v) => v - 1);
      setHasUpvoted(false);
    } else {
      setUpvotes((v) => v + (hasDownvoted ? 2 : 1));
      setHasUpvoted(true);
      setHasDownvoted(false);
    }
  };

  const handleDownvote = () => {
    if (hasDownvoted) {
      setUpvotes((v) => v + 1);
      setHasDownvoted(false);
    } else {
      setUpvotes((v) => v - (hasUpvoted ? 2 : 1));
      setHasDownvoted(true);
      setHasUpvoted(false);
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(commentInput);
    setCommentInput("");
  };

  const handleShareComment = () => {
    if (userScoreText) {
      onAddComment(userScoreText);
    }
  };

  return (
    <div className="w-full bg-[#030303] text-[#f8fafc] min-h-screen py-6 px-4 md:px-0 font-sans">
      <div className="max-w-[850px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Main Content (upvote and post content) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Main Reddit Post Frame */}
          <div className="bg-[#09090b] rounded-xl border border-[#1a1a1b] overflow-hidden flex flex-col shadow-xl">
            
            {/* Post Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Subreddit Emblem */}
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#ff4500] to-[#ff6a00] flex items-center justify-center font-bold text-white text-xs">
                  C
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-gray-100 hover:underline cursor-pointer">r/ChromaDaily</span>
                    <span className="text-gray-400 text-xs">•</span>
                    <span className="text-gray-400 text-xs hover:underline cursor-pointer">u/DevvitManager</span>
                    <span className="bg-[#ff4500] text-[10px] text-white px-1.5 py-0.5 rounded font-bold">Devvit Staff</span>
                  </div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-1">
                    <span>12 hours ago</span>
                    <span>•</span>
                    <span className="text-[#ff4500] font-semibold flex items-center gap-0.5">
                      <ShieldAlert size={10} /> pinned by moderators
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Sound control inside standard Reddit titlebar */}
                <button
                  onClick={onToggleSound}
                  className="p-1.5 rounded bg-[#1a1a1b] hover:bg-[#272729] text-gray-400 hover:text-white transition-colors"
                  title={isSoundEnabled ? "Mute Game Sound" : "Unmute Game Sound"}
                >
                  {isSoundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button className="text-gray-400 hover:text-white p-1">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>

            {/* Post Title */}
            <div className="px-4 pb-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                🏆 Daily Color Puzzle - June 18, 2026. Can you match today&apos;s target color with 99%+ accuracy? [Reddit Devvit Showcase]
              </h1>
              <div className="flex gap-2 mt-1.5">
                <span className="text-[11px] bg-[#1a1a1b] text-gray-300 px-2 py-0.5 rounded-full font-medium">Devvit Web App</span>
                <span className="text-[11px] bg-[#ff4500]/10 text-[#ff4500] px-2 py-0.5 rounded-full font-medium">Daily Puzzle</span>
              </div>
            </div>

            {/* Devvit Application Iframe Canvas viewport container - CENTERED */}
            <div className="bg-[#030303] py-6 px-2 md:px-0 flex justify-center border-y border-[#1a1a1b]">
              <div className="w-full max-w-[600px] flex flex-col bg-[#09090b] rounded-xl shadow-2xl overflow-hidden border border-[#1a1a1b]">
                {children}
              </div>
            </div>

            {/* Post Footer Actions */}
            <div className="p-2.5 bg-[#09090b] flex items-center justify-between text-gray-400 text-xs font-semibold border-t border-[#1a1a1b]/40">
              <div className="flex gap-4 items-center">
                
                {/* Simulated Reddit Upvotes Bar */}
                <div className="flex items-center gap-1 bg-[#1a1a1b] rounded-full p-1.5 px-3">
                  <button 
                    onClick={handleUpvote}
                    className={`hover:text-[#ff4500] transition-colors ${hasUpvoted ? "text-[#ff4500]" : ""}`}
                  >
                    ▲
                  </button>
                  <span className={`text-xs ${hasUpvoted ? "text-[#ff4500]" : hasDownvoted ? "text-blue-500" : "text-gray-300"}`}>
                    {upvotes}
                  </span>
                  <button 
                    onClick={handleDownvote}
                    className={`hover:text-blue-500 transition-colors ${hasDownvoted ? "text-blue-500" : ""}`}
                  >
                    ▼
                  </button>
                </div>

                <div className="flex items-center gap-1.5 hover:bg-[#1a1a1b] rounded-full p-1.5 px-3 cursor-pointer">
                  <MessageSquare size={16} />
                  <span>{comments.length} Comments</span>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 hover:bg-[#1a1a1b] rounded-full p-1.5 px-3 cursor-pointer">
                  <Share2 size={16} />
                  <span>Share</span>
                </div>
              </div>

              {userScoreText && (
                <button
                  onClick={handleShareComment}
                  className="bg-[#ff4500] hover:bg-[#ff5722] text-white rounded-full px-4 py-1.5 text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  ✍️ Share Score in Comments
                </button>
              )}
            </div>
          </div>

          {/* Comments Feed Panel */}
          <div className="bg-[#09090b] rounded-xl border border-[#1a1a1b] p-4 flex flex-col gap-4 shadow-xl">
            <h3 className="text-sm font-semibold tracking-wide text-gray-300 border-b border-[#1a1a1b]/60 pb-2">
              Comment Section ({comments.length} comments sorted by Hot)
            </h3>

            {/* Form writing user comment */}
            <form onSubmit={handleCommentSubmit} className="flex flex-col gap-2">
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Join the discussion... write how close you got, share tips, or discuss RGB tricks!"
                className="w-full bg-[#1a1a1b] rounded-lg border border-[#1a1a1b] p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#ff4500] transition-colors resize-y min-h-[70px]"
              />
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gray-500 font-mono">
                  Markdown formatting supported.
                </span>
                <button
                  type="submit"
                  disabled={!commentInput.trim()}
                  className="bg-[#ff4500] hover:bg-[#ff5722] disabled:bg-[#1a1a1b] disabled:text-gray-500 text-white text-xs font-bold rounded-full px-4 py-1.5 transition-colors"
                >
                  Comment
                </button>
              </div>
            </form>

            {/* List of comment bubble lines */}
            <div className="flex flex-col gap-5 mt-2">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 text-sm border-l-2 border-[#1a1a1b] pl-3.5 ml-1">
                  
                  {/* Snoo generic rounded indicator avatar */}
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-sm bg-gradient-to-tr from-[#9a2800] to-[#ff4500] flex items-center justify-center font-bold text-xs text-white">
                      {comment.username.replace("u/", "").substring(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-200 text-xs hover:underline cursor-pointer">
                        {comment.username}
                      </span>
                      {comment.badge && (
                        <span className={`text-[10px] px-1.5 py-0.25 rounded font-bold uppercase tracking-wider ${
                          comment.badge === "Gold" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                          comment.badge === "Silver" ? "bg-slate-400/20 text-slate-300 border border-slate-400/30" :
                          comment.badge === "Bronze" ? "bg-amber-700/20 text-amber-600 border border-amber-700/30" :
                          "bg-[#1a1a1b] text-gray-400 border border-[#1a1a1b]"
                        }`}>
                          {comment.badge} Badge
                        </span>
                      )}
                      {comment.isUser && (
                        <span className="text-[10px] bg-[#ff4500]/20 text-[#ff4500] px-1.5 py-0.25 rounded border border-[#ff4500]/30">
                          YOU
                        </span>
                      )}
                      <span className="text-[11px] text-gray-500 font-mono">{comment.timeAgo}</span>
                    </div>

                    <p className="text-gray-300 mt-1.5 whitespace-pre-line leading-relaxed text-sm">
                      {comment.text}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 font-semibold font-mono">
                      <button className="hover:text-orange-500">▲</button>
                      <span>{comment.ups}</span>
                      <button className="hover:text-blue-500">▼</button>
                      <button className="hover:text-white transition-colors ml-2">Reply</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>

        {/* Right Column - Subreddit Info Cards Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-[#09090b] rounded-xl border border-[#1a1a1b] overflow-hidden shadow-xl">
            <div className="h-10 bg-gradient-to-r from-[#ff4500] to-[#ff6a00]"></div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 -mt-8">
                <div className="w-12 h-12 rounded-lg border-2 border-[#09090b] bg-gradient-to-tr from-[#ff4500] to-[#ff6a00] flex items-center justify-center font-extrabold text-white text-lg">
                  C
                </div>
                <span className="font-bold text-sm text-gray-200 mt-4">r/ChromaDaily</span>
              </div>
              
              <p className="text-xs text-gray-300 leading-normal">
                Devvit Web interactive matching playground! A daily ritual testing human RGB wavelength interpretation limits. Play, complete streaks, share with others.
              </p>

              <div className="flex flex-col gap-2 border-y border-[#1a1a1b] py-3 text-xs text-gray-400 font-mono">
                <div className="flex justify-between">
                  <span>Members</span>
                  <span className="text-gray-200">24,531</span>
                </div>
                <div className="flex justify-between">
                  <span>Online</span>
                  <span className="text-[#ff4500] flex items-center gap-1 font-bold">
                    ● 1,102 online
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[#1a1a1b] rounded p-2.5 text-xs text-gray-300 border border-[#1e1e21]">
                <BadgeInfo size={20} className="text-[#ff4500] shrink-0" />
                <span className="leading-tight">
                  This game is built on <strong>Reddit Devvit Web</strong> APIs, powered by React wrapper + Phaser 3 gaming framework.
                </span>
              </div>

              <button className="w-full bg-[#ff4500] hover:bg-[#ff5722] text-white text-xs font-bold py-2 rounded-full transition-colors mt-1 hover:scale-[1.02] active:scale-[0.98]">
                Join Community
              </button>
            </div>
          </div>

          {/* Rules Card */}
          <div className="bg-[#09090b] rounded-xl border border-[#1a1a1b] p-4 flex flex-col gap-3 shadow-xl">
            <h4 className="text-xs font-bold text-gray-405 tracking-wider uppercase">r/ChromaDaily Rules</h4>
            <ol className="text-xs text-gray-300 flex flex-col gap-2.5 list-decimal pl-4 leading-normal">
              <li>No guessing cheats or peeking at JavaScript source.</li>
              <li>Always post your score grid in comments to challenge peers.</li>
              <li>Explain your mixing strategy when achieving Gold Badge (99%+).</li>
              <li>Respect the 1-play-per-day rule. Midnight UTC refreshes all.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
