import { getDocuments, createDocument as createFirestoreDoc, updateDocument, getDocument, deleteDocument } from './firestore';
import { createMovement, getDocumentPendingBalance } from './movements';

// ============ Create Termo ============

export async function createTermo(data) {
  try {
    // 1. Get current maximum sequential number
    const termos = await getDocuments('termos', [], 'number', 'desc');
    let nextNumber = 1;

    if (termos.length > 0 && termos[0].number) {
      nextNumber = Number(termos[0].number) + 1;
    }

    const qty = Number(data.quantity);
    let movementId = data.movementId || null;

    // 2. Validate pending balance for selected documents (when creating from /termos page)
    //    Skip validation when movementId is provided (created from /saida page, already validated there)
    if (!movementId && data.selectedDocsDetails && data.selectedDocsDetails.length > 0) {
      for (const doc of data.selectedDocsDetails) {
        const pendingBalance = await getDocumentPendingBalance(
          doc.documentNumber,
          data.industryId,
          'transferencia'
        );
        const requestedQty = Number(doc.devolvidoAgora) || 0;

        if (pendingBalance <= 0) {
          throw new Error(
            `O documento ${doc.documentNumber} já foi totalmente baixado (saldo: ${pendingBalance}). Não é possível gerar um termo para este documento.`
          );
        }

        if (requestedQty > pendingBalance) {
          throw new Error(
            `O documento ${doc.documentNumber} possui saldo disponível de ${pendingBalance} pallets, mas está sendo solicitado ${requestedQty}. Ajuste a quantidade para o saldo restante.`
          );
        }
      }
    }

    // 3. Determine original NF numbers from selectedDocsDetails (used for display)
    const originalNfNumbers = (data.selectedDocsDetails && data.selectedDocsDetails.length > 0)
      ? data.selectedDocsDetails.map(d => d.documentNumber).join(', ')
      : null;

    // 4. If movement does not exist yet (generated from /termos), create movements to abate balance
    //    Create ONE movement per NF so getPendingDocuments can match & deduct correctly
    const termoNumber = `Termo Nº ${String(nextNumber).padStart(4, '0')}`;
    const baseNotes = `Gerado via ${termoNumber}${data.motorista ? ` - Mot: ${data.motorista}` : ''}${data.lacre ? ` - Lacre: ${data.lacre}` : ''}`;
    let movementIds = [];

    if (!movementId) {
      if (data.selectedDocsDetails && data.selectedDocsDetails.length > 0) {
        // Create one movement per NF with its specific quantity
        for (const doc of data.selectedDocsDetails) {
          const docQty = Number(doc.devolvidoAgora) || 0;
          if (docQty <= 0) continue;

          const movId = await createMovement({
            type: 'saida',
            category: 'transferencia',
            quantity: docQty,
            date: data.date,
            industryId: data.industryId,
            clientId: null,
            documentNumber: doc.documentNumber,
            distribuidor: data.distribuidor || null,
            notes: `${baseNotes} — NF ${doc.documentNumber}`,
            createdBy: data.createdBy,
            createdByName: data.createdByName,
          });
          movementIds.push(movId);
        }
      } else {
        // No NFs selected — single movement with termo number or manual docNumber
        const fallbackDocNumber = data.documentNumber || termoNumber;
        const movId = await createMovement({
          type: 'saida',
          category: 'transferencia',
          quantity: qty,
          date: data.date,
          industryId: data.industryId,
          clientId: null,
          documentNumber: fallbackDocNumber,
          distribuidor: data.distribuidor || null,
          notes: baseNotes,
          createdBy: data.createdBy,
          createdByName: data.createdByName,
        });
        movementIds.push(movId);
      }
    } else {
      // Movement(s) already exist (created from /saida page)
      movementIds = Array.isArray(movementId) ? movementId : [movementId];
    }

    // 5. Create the termo document
    const termoId = await createFirestoreDoc('termos', {
      ...data,
      quantity: qty,
      number: nextNumber,
      movementId: movementIds.length === 1 ? movementIds[0] : movementIds,
      documentNumber: termoNumber,
      originalDocumentNumbers: originalNfNumbers,
      status: 'ativo',
    });

    return { id: termoId, number: nextNumber, movementId };
  } catch (err) {
    console.error('Erro ao gerar termo:', err);
    throw err;
  }
}

export async function cancelTermo(termoId) {
  try {
    const termo = await getDocument('termos', termoId);
    if (termo?.movementId) {
      // movementId can be a single string or an array (multiple NFs)
      const ids = Array.isArray(termo.movementId) ? termo.movementId : [termo.movementId];
      for (const id of ids) {
        await deleteDocument('movements', id);
      }
    }
    await updateDocument('termos', termoId, { status: 'cancelado' });
    return true;
  } catch (err) {
    console.error('Erro ao cancelar termo:', err);
    throw err;
  }
}
