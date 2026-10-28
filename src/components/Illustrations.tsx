import React from "react";
import { FoodId } from "../data/dialogueData";

export const FriendsWalkingIllustration: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg
    viewBox="0 0 480 280"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-full h-auto ${className}`}
    role="img"
    aria-label="Illustration of 3 middle school friends walking home after school talking about dinner food choices"
  >
    {/* Warm Sunset After-School Sky Backdrop */}
    <rect width="480" height="280" rx="20" fill="#FFF7ED" />
    <path d="M0 210 C120 202, 360 202, 480 210 L480 280 L0 280 Z" fill="#F1F5F9" />
    <path d="M0 218 L480 218" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="8 8" />

    {/* Background School & Street Details */}
    <rect x="28" y="88" width="92" height="122" rx="6" fill="#E2E8F0" />
    <rect x="40" y="104" width="24" height="24" rx="3" fill="#FFFBEB" />
    <rect x="76" y="104" width="24" height="24" rx="3" fill="#FFFBEB" />
    <rect x="40" y="140" width="24" height="24" rx="3" fill="#FFFBEB" />
    <rect x="76" y="140" width="24" height="24" rx="3" fill="#FFFBEB" />
    <circle cx="74" cy="74" r="10" fill="#F8FAFC" stroke="#64748B" strokeWidth="2" />
    <path d="M74 68 V74 H79" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />

    {/* Floating Thought Bubbles About Food */}
    {/* Bubble 1: Pizza */}
    <g transform="translate(88, 22)">
      <rect x="0" y="0" width="88" height="44" rx="14" fill="#FFFFFF" stroke="#FDA4AF" strokeWidth="2" />
      <circle cx="24" cy="52" r="4" fill="#FFFFFF" stroke="#FDA4AF" strokeWidth="2" />
      <path d="M18 32 L30 12 L42 32 Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1.8" />
      <circle cx="29" cy="24" r="2.2" fill="#DC2626" />
      <circle cx="33" cy="28" r="2.2" fill="#DC2626" />
      <text x="48" y="27" fill="#0F172A" fontSize="12" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
        Pizza?
      </text>
    </g>

    {/* Bubble 2: Tteokbokki */}
    <g transform="translate(198, 12)">
      <rect x="0" y="0" width="114" height="46" rx="14" fill="#FFFFFF" stroke="#FDBA74" strokeWidth="2" />
      <circle cx="56" cy="54" r="4" fill="#FFFFFF" stroke="#FDBA74" strokeWidth="2" />
      <path d="M16 26 C16 33, 38 33, 38 26 Z" fill="#EF4444" />
      <rect x="19" y="19" width="8" height="5" rx="2.5" fill="#FCA5A5" />
      <rect x="27" y="18" width="8" height="5" rx="2.5" fill="#FCA5A5" />
      <text x="44" y="28" fill="#0F172A" fontSize="12" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
        Tteokbokki!
      </text>
    </g>

    {/* Bubble 3: Burger */}
    <g transform="translate(332, 24)">
      <rect x="0" y="0" width="96" height="44" rx="14" fill="#FFFFFF" stroke="#93C5FD" strokeWidth="2" />
      <circle cx="42" cy="52" r="4" fill="#FFFFFF" stroke="#93C5FD" strokeWidth="2" />
      <path d="M16 21 C16 14, 38 14, 38 21 Z" fill="#F59E0B" />
      <rect x="15" y="22" width="24" height="4" rx="2" fill="#78350F" />
      <rect x="16" y="27" width="22" height="4" rx="2" fill="#F59E0B" />
      <text x="45" y="27" fill="#0F172A" fontSize="12" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
        Burger?
      </text>
    </g>

    {/* Friend 1 (Left - Wearing Backpack & School Cardigan) */}
    <g transform="translate(122, 86)">
      {/* Backpack */}
      <rect x="6" y="48" width="22" height="44" rx="8" fill="#F97316" />
      {/* Legs */}
      <path d="M24 108 L18 158" stroke="#1E293B" strokeWidth="9" strokeLinecap="round" />
      <path d="M40 108 L46 158" stroke="#1E293B" strokeWidth="9" strokeLinecap="round" />
      {/* Shoes */}
      <rect x="10" y="154" width="16" height="8" rx="4" fill="#FFFFFF" stroke="#334155" strokeWidth="2" />
      <rect x="40" y="154" width="16" height="8" rx="4" fill="#FFFFFF" stroke="#334155" strokeWidth="2" />
      {/* Torso */}
      <rect x="14" y="44" width="36" height="66" rx="14" fill="#2563EB" />
      <path d="M26 44 L32 58 L38 44" fill="#FFFFFF" />
      {/* Head */}
      <circle cx="32" cy="22" r="18" fill="#FDE68A" />
      {/* Hair */}
      <path d="M14 20 C14 6, 50 6, 50 20 C44 13, 22 13, 14 20 Z" fill="#1E293B" />
      {/* Eyes & Smile */}
      <circle cx="27" cy="22" r="2" fill="#0F172A" />
      <circle cx="39" cy="22" r="2" fill="#0F172A" />
      <path d="M28 29 Q33 34 38 29" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      {/* Raising Hand */}
      <path d="M46 58 L64 44" stroke="#2563EB" strokeWidth="8" strokeLinecap="round" />
    </g>

    {/* Friend 2 (Center - Student Speaker) */}
    <g transform="translate(212, 82)">
      {/* Backpack */}
      <rect x="40" y="50" width="20" height="44" rx="8" fill="#0D9488" />
      {/* Legs */}
      <path d="M24 112 L20 162" stroke="#334155" strokeWidth="9" strokeLinecap="round" />
      <path d="M40 112 L44 162" stroke="#334155" strokeWidth="9" strokeLinecap="round" />
      {/* Shoes */}
      <rect x="12" y="158" width="16" height="8" rx="4" fill="#FFFFFF" stroke="#334155" strokeWidth="2" />
      <rect x="38" y="158" width="16" height="8" rx="4" fill="#FFFFFF" stroke="#334155" strokeWidth="2" />
      {/* Jacket */}
      <rect x="12" y="46" width="40" height="68" rx="14" fill="#F59E0B" />
      <path d="M25 46 L32 62 L39 46" fill="#FFFFFF" />
      {/* Head */}
      <circle cx="32" cy="22" r="19" fill="#FDE68A" />
      {/* Hair */}
      <path d="M12 22 C12 4, 52 4, 52 22 C46 14, 18 14, 12 22 Z" fill="#0F172A" />
      {/* Face */}
      <circle cx="26" cy="22" r="2.2" fill="#0F172A" />
      <circle cx="38" cy="22" r="2.2" fill="#0F172A" />
      <path d="M26 30 Q32 36 38 30" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" />
    </g>

    {/* Friend 3 (Right - Classmate Friend) */}
    <g transform="translate(306, 86)">
      {/* Backpack */}
      <rect x="36" y="48" width="22" height="44" rx="8" fill="#6366F1" />
      {/* Legs */}
      <path d="M22 108 L18 158" stroke="#1E293B" strokeWidth="9" strokeLinecap="round" />
      <path d="M38 108 L44 158" stroke="#1E293B" strokeWidth="9" strokeLinecap="round" />
      {/* Shoes */}
      <rect x="10" y="154" width="16" height="8" rx="4" fill="#FFFFFF" stroke="#334155" strokeWidth="2" />
      <rect x="38" y="154" width="16" height="8" rx="4" fill="#FFFFFF" stroke="#334155" strokeWidth="2" />
      {/* Torso */}
      <rect x="12" y="44" width="38" height="66" rx="14" fill="#E11D48" />
      <path d="M25 44 L31 58 L37 44" fill="#FFFFFF" />
      {/* Head */}
      <circle cx="31" cy="22" r="18" fill="#FDE68A" />
      {/* Hair */}
      <path d="M12 24 C10 5, 52 5, 50 24 C45 14, 17 14, 12 24 Z" fill="#1E293B" />
      {/* Eyes & Smile */}
      <circle cx="25" cy="22" r="2" fill="#0F172A" />
      <circle cx="36" cy="22" r="2" fill="#0F172A" />
      <path d="M25 29 Q30.5 34 36 29" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      {/* Gesturing Arm */}
      <path d="M14 58 L-2 46" stroke="#E11D48" strokeWidth="8" strokeLinecap="round" />
    </g>
  </svg>
);

export const FoodIllustration: React.FC<{ foodId: FoodId; className?: string }> = ({
  foodId,
  className = "w-14 h-14",
}) => {
  if (foodId === "pizza") {
    return (
      <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill="#FEF3C7" />
        <path
          d="M32 10 L52 48 C40 54, 24 54, 12 48 Z"
          fill="#FBBF24"
          stroke="#D97706"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M12 46 C24 52, 40 52, 52 46"
          stroke="#B45309"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="32" cy="28" r="4" fill="#DC2626" />
        <circle cx="25" cy="38" r="3.5" fill="#DC2626" />
        <circle cx="39" cy="39" r="3.5" fill="#DC2626" />
        <path d="M29 33 C30 35, 34 35, 35 33" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (foodId === "tteokbokki") {
    return (
      <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill="#FFEDD5" />
        {/* Steam lines */}
        <path d="M24 14 Q22 18 25 22" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 12 Q30 16 33 20" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" />
        <path d="M40 14 Q38 18 41 22" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" />
        {/* Rice cakes in spicy sauce */}
        <rect x="16" y="25" width="14" height="8" rx="4" transform="rotate(-12 16 25)" fill="#FFF1F2" stroke="#E11D48" strokeWidth="2" />
        <rect x="28" y="23" width="14" height="8" rx="4" transform="rotate(10 28 23)" fill="#FFF1F2" stroke="#E11D48" strokeWidth="2" />
        <rect x="22" y="29" width="15" height="8" rx="4" fill="#FECDD3" stroke="#BE123C" strokeWidth="2" />
        <circle cx="42" cy="31" r="4.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="1.8" />
        {/* Bowl */}
        <path
          d="M12 34 H52 L46 49 C44 52, 20 52, 18 49 Z"
          fill="#EA580C"
          stroke="#9A3412"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="#FEF9C3" />
      {/* Top Bun */}
      <path
        d="M14 28 C14 15, 50 15, 50 28 Z"
        fill="#F59E0B"
        stroke="#B45309"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="21" r="1.3" fill="#FEF3C7" />
      <circle cx="33" cy="19" r="1.3" fill="#FEF3C7" />
      <circle cx="39" cy="22" r="1.3" fill="#FEF3C7" />
      {/* Lettuce & Cheese */}
      <path d="M12 31 Q20 34 26 31 Q32 34 38 31 Q44 34 52 31" stroke="#16A34A" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M16 34 L28 39 L40 34 L49 34" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
      {/* Patty */}
      <rect x="14" y="35" width="36" height="7" rx="3.5" fill="#78350F" stroke="#451A03" strokeWidth="2" />
      {/* Bottom Bun */}
      <rect x="15" y="43" width="34" height="7" rx="3.5" fill="#F59E0B" stroke="#B45309" strokeWidth="2.2" />
    </svg>
  );
};

export const PartnerAvatar: React.FC<{ name: string; className?: string }> = ({
  name,
  className = "w-12 h-12",
}) => (
  <svg
    viewBox="0 0 56 56"
    fill="none"
    className={`shrink-0 ${className}`}
    role="img"
    aria-label={`Classmate partner ${name}`}
  >
    <circle cx="28" cy="28" r="26" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" />
    <circle cx="28" cy="24" r="12" fill="#FDE68A" />
    <path d="M15 22 C15 10, 41 10, 41 22 C36 16, 20 16, 15 22 Z" fill="#1E293B" />
    <circle cx="24" cy="24" r="1.8" fill="#0F172A" />
    <circle cx="32" cy="24" r="1.8" fill="#0F172A" />
    <path d="M24 29 Q28 33 32 29" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
    <path d="M14 48 C16 38, 40 38, 42 48" fill="#2563EB" />
  </svg>
);

export const CoachAvatar: React.FC<{ className?: string }> = ({ className = "w-11 h-11" }) => (
  <svg
    viewBox="0 0 56 56"
    fill="none"
    className={`shrink-0 ${className}`}
    role="img"
    aria-label="Supportive speaking coach avatar"
  >
    <circle cx="28" cy="28" r="26" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
    <circle cx="28" cy="24" r="12" fill="#FDE68A" />
    <path d="M16 21 C16 11, 40 11, 40 21 C34 16, 22 16, 16 21 Z" fill="#78350F" />
    <circle cx="24" cy="24" r="2.2" fill="#0F172A" />
    <circle cx="32" cy="24" r="2.2" fill="#0F172A" />
    <rect x="20" y="21" width="7" height="5" rx="2" stroke="#475569" strokeWidth="1.4" />
    <rect x="29" y="21" width="7" height="5" rx="2" stroke="#475569" strokeWidth="1.4" />
    <path d="M24 30 Q28 33.5 32 30" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
    <path d="M15 48 C17 38, 39 38, 41 48" fill="#D97706" />
  </svg>
);
