import { getDocuments, createDocument as createFirestoreDoc, updateDocument, getDocument, deleteDocument } from './firestore';
import { createMovement, calculateBalance } from './movements';

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

    // 2. If movement does not exist yet (generated from /termos), create it to abate balance
    if (!movementId) {
      const currentBalance = await calculateBalance({
        category: 'transferencia',
        industryId: data.industryId || null,
      });

      if (currentBalance < qty) {
        throw new Error(
          `Saldo insuficiente para gerar o termo. Saldo disponível na indústria: ${currentBalance} pallets. Quantidade do termo: ${qty} pallets.`
        );
      }

      const docNumber = data.documentNumber
        ? data.documentNumber
        : `Termo Nº ${String(nextNumber).padStart(4, '0')}`;

      const movementData = {
        type: 'saida',
        category: 'transferencia',
        quantity: qty,
        date: data.date,
        industryId: data.industryId,
        clientId: null,
        documentNumber: docNumber,
        notes: `Gerado via Termo Pallet Nº ${String(nextNumber).padStart(4, '0')}${data.motorista ? ` - Mot: ${data.motorista}` : ''}${data.lacre ? ` - Lacre: ${data.lacre}` : ''}`,
        createdBy: data.createdBy,
        createdByName: data.createdByName,
      };

      movementId = await createMovement(movementData);
    }

    const docNumber = data.documentNumber
      ? data.documentNumber
      : `Termo Nº ${String(nextNumber).padStart(4, '0')}`;

    // 3. Create the termo document
    const termoId = await createFirestoreDoc('termos', {
      ...data,
      quantity: qty,
      number: nextNumber,
      movementId: movementId,
      documentNumber: docNumber,
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
