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

    // 3. Determine original NF numbers from selectedDocsDetails (used for movement matching)
    const originalNfNumbers = (data.selectedDocsDetails && data.selectedDocsDetails.length > 0)
      ? data.selectedDocsDetails.map(d => d.documentNumber).join(', ')
      : null;

    // 4. If movement does not exist yet (generated from /termos), create it to abate balance
    //    Use the original NF numbers so getPendingDocuments can match & deduct correctly
    if (!movementId) {
      const movementDocNumber = originalNfNumbers || data.documentNumber || `Termo Nº ${String(nextNumber).padStart(4, '0')}`;

      const movementData = {
        type: 'saida',
        category: 'transferencia',
        quantity: qty,
        date: data.date,
        industryId: data.industryId,
        clientId: null,
        documentNumber: movementDocNumber,
        notes: `Gerado via Termo Pallet Nº ${String(nextNumber).padStart(4, '0')}${data.motorista ? ` - Mot: ${data.motorista}` : ''}${data.lacre ? ` - Lacre: ${data.lacre}` : ''}`,
        createdBy: data.createdBy,
        createdByName: data.createdByName,
      };

      movementId = await createMovement(movementData);
    }

    // 5. Create the termo document — always store the termo number as documentNumber
    const termoNumber = `Termo Nº ${String(nextNumber).padStart(4, '0')}`;
    const termoId = await createFirestoreDoc('termos', {
      ...data,
      quantity: qty,
      number: nextNumber,
      movementId: movementId,
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
      // Delete the movement to restore the balance
      await deleteDocument('movements', termo.movementId);
    }
    await updateDocument('termos', termoId, { status: 'cancelado' });
    return true;
  } catch (err) {
    console.error('Erro ao cancelar termo:', err);
    throw err;
  }
}
