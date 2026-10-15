import { RoomGate } from "../../../components/room-gate";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomGate roomId={roomId} />;
}
