import { chooseMove } from "../../../../packages/titan-ai/src/index.ts";
import type {
  ComputerSearchRequest,
  ComputerSearchResponse,
} from "./computer.ts";

interface WorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<ComputerSearchRequest>) => void,
  ): void;
  postMessage(message: ComputerSearchResponse): void;
}

const workerScope = self as unknown as WorkerScope;

workerScope.addEventListener("message", (event) => {
  const request = event.data;
  const result = chooseMove(request.state, request.difficulty);
  workerScope.postMessage({
    requestId: request.requestId,
    positionHash: request.positionHash,
    result,
  });
});
