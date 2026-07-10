import prisma from "../lib/prisma";
import type { CreateClientInput, UpdateClientInput } from "../lib/validation/client.schema";
import type { ActionResult } from "../types";

export async function getAllClients() {
  return prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { journeys: true } } },
  });
}

export async function getClientById(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { journeys: true } } },
  });
}

export async function createClient(
  data: CreateClientInput
): Promise<ActionResult> {
  try {
    const client = await prisma.client.create({ data });
    return { success: true, data: client };
  } catch {
    return { success: false, error: "Failed to create client" };
  }
}

export async function updateClient(
  id: string,
  data: UpdateClientInput
): Promise<ActionResult> {
  try {
    const client = await prisma.client.update({
      where: { id },
      data,
    });
    return { success: true, data: client };
  } catch {
    return { success: false, error: "Failed to update client" };
  }
}

export async function deleteClient(id: string): Promise<ActionResult> {
  try {
    const existing = await prisma.client.findUnique({
      where: { id },
      include: { journeys: { take: 1 } },
    });

    if (!existing) {
      return { success: false, error: "Client not found" };
    }

    if (existing.journeys.length > 0) {
      return {
        success: false,
        error: "Cannot delete client with associated journeys",
      };
    }

    await prisma.client.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete client" };
  }
}