import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "../../lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    // Create a new room
    const { name, userId } = req.body
    try {
      const room = await prisma.room.create({
        data: {
          name,
          users: {
            connect: { id: userId },
          },
        },
      })
      res.status(201).json(room)
    } catch (error) {
      res.status(400).json({ error: `Failed to create room ${error.message}` })
    }
  } else if (req.method === "GET") {
    // Get all rooms
    try {
      const rooms = await prisma.room.findMany({
        include: { users: true },
      })
      res.status(200).json(rooms)
    } catch (error: unknown) {
      res.status(400).json({ error: `Failed to fetch rooms ${error.message}` })
    }
  } else {
    res.status(405).json({ error: "Method not allowed" })
  }
}

