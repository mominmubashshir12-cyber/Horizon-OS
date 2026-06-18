import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function checkSaleForFraud(
  userId: number,
  productId: number,
  salePrice: number,
  firmId: number
): Promise<{ flagged: boolean; reason?: string }> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) return { flagged: false };

    // 1. Check BELOW_MIN_PRICE
    if (salePrice < product.minSellingPrice) {
      await prisma.antifraudFlag.create({
        data: {
          userId,
          productId,
          flagType: 'BELOW_MIN_PRICE',
          details: `Sale price ${salePrice} is below minimum ${product.minSellingPrice}`,
          firmId
        }
      });
      return { flagged: true, reason: "Price below minimum" };
    }

    // 2. Check MIN_PRICE_STREAK
    if (salePrice === product.minSellingPrice) {
      const allSales = await prisma.sale.findMany({
        where: { userId, productId, firmId },
        orderBy: { createdAt: 'desc' }
      });
      
      let count = 0;
      for (const s of allSales) {
        if (s.unitPrice === product.minSellingPrice) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 5) {
        const existingFlag = await prisma.antifraudFlag.findFirst({
          where: { userId, productId, flagType: 'MIN_PRICE_STREAK', reviewed: false, firmId }
        });

        if (existingFlag) {
          await prisma.antifraudFlag.update({
            where: { id: existingFlag.id },
            data: { consecutiveCount: count }
          });
        } else {
          await prisma.antifraudFlag.create({
            data: {
              userId,
              productId,
              flagType: 'MIN_PRICE_STREAK',
              consecutiveCount: count,
              details: `${count} consecutive sales at minimum price`,
              firmId
            }
          });
        }
        return { flagged: true, reason: "Consecutive minimum price sales" };
      }
    }

    return { flagged: false };
  } catch (error) {
    console.error('[AntifraudService] Error checking sale for fraud:', error);
    return { flagged: false };
  }
}
