import { prisma } from "@/lib/prisma";

export const DAILY_LIMIT = 3;

export type UsageAction = "score" | "optimize";

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function countUsageToday(userId: string, action: UsageAction): Promise<number> {
  return prisma.usageEvent.count({
    where: {
      userId,
      action,
      createdAt: { gte: startOfTodayUTC() },
    },
  });
}

export async function recordUsage(userId: string, action: UsageAction): Promise<void> {
  await prisma.usageEvent.create({ data: { userId, action } });
}

export interface UsageSummary {
  score: { used: number; limit: number };
  optimize: { used: number; limit: number };
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const [scoreUsed, optimizeUsed] = await Promise.all([
    countUsageToday(userId, "score"),
    countUsageToday(userId, "optimize"),
  ]);
  return {
    score: { used: scoreUsed, limit: DAILY_LIMIT },
    optimize: { used: optimizeUsed, limit: DAILY_LIMIT },
  };
}
