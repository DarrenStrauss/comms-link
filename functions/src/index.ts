import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

interface SessionData {
    password?: string;
    offer?: string;
    answer?: string;
}

function sendSuccessResponse(response: functions.Response, data: string) {
  return response.status(200).json({success: true, data});
}

function sendErrorResponse(response: functions.Response, status: number, message: string) {
  return response.status(status).json({success: false, error: message});
}

/**
 * Checks if a session ID is valid.
 * Valid session IDs are non-empty strings and are limited to 100 characters.
 *
 * @param sessionID The ID to check
 * @returns true if the ID is valid, otherwise false
 */
function isValidSessionID(sessionID: string) {
  if (!sessionID || sessionID.length > 100) {
    return false;
  }

  return true;
}

/**
 * Function for publishing a new session offer.
 * The request body should contain a session ID and an offer SDP.
 * Optionally, the request body can also contain a password.
 * This will result in a new document created in the database, with the document ID equal to the session ID.
 */
exports.sessionOffer = functions.region("australia-southeast1").https.onRequest(async (request, response) => {
  const sessionID: string = request.body.sessionID?.toString() ?? "";

  if (!isValidSessionID(sessionID)) {
    sendErrorResponse(response, 403, "Invalid session ID");

    return;
  }

  const offer: SessionData = {
    password: request.body.password ?? "",
    offer: request.body.offer ?? ""
  };

  if (!offer.offer) {
    sendErrorResponse(response, 403, "Invalid offer");

    return;
  }

  const sessionDocumentData = admin.firestore().collection("sessions").doc(sessionID);

  try {
    await sessionDocumentData.set(offer, {merge: true});
    sendSuccessResponse(response, "Success");
  } catch (error) {
    sendErrorResponse(response, 500, `Error: ${error}`);
  }
});

/**
 * Function for retrieving a session offer SDP.
 * The request query parameters should contain the session ID.
 * If the session was created with a password, the request query parameters should contain a matching password.
 */
exports.getOffer = functions.region("australia-southeast1").https.onRequest(async (request, response) => {
  const sessionID: string = request.query.sessionID?.toString() ?? "";
  const requestPassword: string = request.query.password?.toString() ?? "";

  if (!isValidSessionID(sessionID)) {
    sendErrorResponse(response, 403, "Invalid session ID");

    return;
  }

  const sessionDocumentData = await admin.firestore().collection("sessions").doc(sessionID).get();

  try {
    if (sessionDocumentData.exists) {
      const offer = sessionDocumentData.get("offer");
      const storedPassword = sessionDocumentData.get("password")?.toString();

      if (storedPassword) {
        if (requestPassword != storedPassword) {
          sendErrorResponse(response, 403, "Invalid or incorrect password");

          return;
        }
      }
      sendSuccessResponse(response, offer);
    } else {
      sendErrorResponse(response, 404, "Session offer not found");
    }
  } catch (error) {
    sendErrorResponse(response, 500, `Error: ${error}`);
  }
});

/**
 * Function for publishing an answer SDP for an existing offer.
 * The request body should contain the session ID and an answer SDP.
 * If the session offer was created with a password, the request body should contain a matching password.
 */
exports.sessionAnswer = functions.region("australia-southeast1").https.onRequest(async (request, response) => {
  const sessionID: string = request.body.sessionID?.toString() ?? "";
  const requestPassword: string = request.body.password?.toString() ?? "";

  if (!isValidSessionID(sessionID)) {
    sendErrorResponse(response, 403, "Invalid session ID");

    return;
  }

  const sessionDocument = admin.firestore().collection("sessions").doc(sessionID);
  const sessionDocumentData = await sessionDocument.get();

  try {
    if (sessionDocumentData.exists) {
      const storedPassword = sessionDocumentData.get("password")?.toString();

      if (storedPassword) {
        if (requestPassword != storedPassword) {
          sendErrorResponse(response, 403, "Invalid or incorrect password");

          return;
        }
      }
      if (!sessionDocumentData.get("offer")) {
        sendErrorResponse(response, 403, "Session offer not found");

        return;
      }
      const answer: SessionData = {answer: request.body.answer ?? ""};
      await sessionDocument.set(answer, {merge: true});
      sendSuccessResponse(response, "Success");
    } else {
      sendErrorResponse(response, 404, "Session offer not found");
    }
  } catch (error) {
    sendErrorResponse(response, 500, `Error: ${error}`);
  }
});

/**
 * Function for retrieving an answer SDP.
 * The request query parameters should contain the session ID.
 */
exports.getAnswer = functions.region("australia-southeast1").https.onRequest(async (request, response) => {
  const sessionID: string = request.query.sessionID?.toString() ?? "";

  if (!isValidSessionID(sessionID)) {
    sendErrorResponse(response, 403, "Invalid session ID");

    return;
  }

  const sessionDocumentData = await admin.firestore().collection("sessions").doc(sessionID).get();

  try {
    if (sessionDocumentData.exists) {
      const answer = sessionDocumentData.get("answer");

      if (answer) {
        sendSuccessResponse(response, answer);
      } else {
        sendErrorResponse(response, 404, "Session answer not found");
      }
    } else {
      sendErrorResponse(response, 403, "Session does not exist");
    }
  } catch (error) {
    sendErrorResponse(response, 500, `Error: ${error}`);
  }
});
