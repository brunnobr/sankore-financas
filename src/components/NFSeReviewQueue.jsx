import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function NFSeReviewQueue() {
  const { user } = useAuth();
  const [nfses, setNfses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(null);
  const [rejeitando, setRejeitando] = useState(null);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    carregarPendentes();
  }, [user?.id]);

  const carregarPendentes = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nfse')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pendente_revisao')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNfses(data || []);
    } catch (err) {
      setMensagem(`Erro ao carregar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async (nfseId) => {
    if (!user) return;

    setConfirmando(nfseId);

    try {
      // 1. Atualizar status da NFS-e
      const { data: nfse, error: updateError } = await supabase
        .from('nfse')
        .update({
          status: 'confirmada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', nfseId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // 2. Criar registro em nfse_transactions (vínculo com transação de receita)
      await supabase
        .from('nfse_transactions')
        .insert({
          user_id: user.id,
          nfse_id: nfseId,
          data: nfse.competencia,
          descricao: `NFS-e ${nfse.numero || 'sem nº'} - ${nfse.tomador}`,
          valor: nfse.valor,
          categoria: 'receita_servicos',
          banco_conta: 'MEI-Receitas',
        });

      // 3. Log de auditoria
      await supabase
        .from('nfse_audit')
        .insert({
          user_id: user.id,
          nfse_id: nfseId,
          acao: 'confirmada',
          depois: nfse,
        });

      // Atualizar lista local
      setNfses(nfses.filter((n) => n.id !== nfseId));
      setMensagem('✓ NFS-e confirmada!');

      setTimeout(() => setMensagem(''), 3000);
    } catch (err) {
      setMensagem(`✗ Erro ao confirmar: ${err.message}`);
    } finally {
      setConfirmando(null);
    }
  };

  const handleRejeitar = async (nfseId, motivo) => {
    if (!user) return;

    setRejeitando(nfseId);

    try {
      // 1. Atualizar status
      const { data: nfse, error: updateError } = await supabase
        .from('nfse')
        .update({
          status: 'rejeitada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', nfseId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // 2. Log de auditoria com motivo
      await supabase
        .from('nfse_audit')
        .insert({
          user_id: user.id,
          nfse_id: nfseId,
          acao: 'rejeitada',
          motivo: motivo || 'Sem motivo especificado',
          antes: nfse,
        });

      // Atualizar lista local
      setNfses(nfses.filter((n) => n.id !== nfseId));
      setMensagem('✗ NFS-e rejeitada');

      setTimeout(() => setMensagem(''), 3000);
    } catch (err) {
      setMensagem(`Erro ao rejeitar: ${err.message}`);
    } finally {
      setRejeitando(null);
    }
  };

  if (loading) {
    return (
      <div className="nfse-queue">
        <p>Carregando...</p>
      </div>
    );
  }

  if (nfses.length === 0) {
    return (
      <div className="nfse-queue">
        <p className="vazio">Nenhuma NFS-e pendente de revisão</p>
      </div>
    );
  }

  return (
    <div className="nfse-queue">
      <h3>Revisão de NFS-e ({nfses.length})</h3>

      {mensagem && <div className="mensagem">{mensagem}</div>}

      <div className="queue-list">
        {nfses.map((nfse) => (
          <NFSeCard
            key={nfse.id}
            nfse={nfse}
            onConfirm={() => handleConfirmar(nfse.id)}
            onReject={(motivo) => handleRejeitar(nfse.id, motivo)}
            confirmando={confirmando === nfse.id}
            rejeitando={rejeitando === nfse.id}
          />
        ))}
      </div>

      <style jsx>{`
        .nfse-queue {
          padding: 20px;
        }

        h3 {
          margin-top: 0;
          margin-bottom: 20px;
        }

        .vazio {
          text-align: center;
          color: #999;
          padding: 40px 20px;
        }

        .mensagem {
          background: #e8f5e9;
          border: 1px solid #4caf50;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 20px;
          color: #2e7d32;
        }

        .queue-list {
          display: grid;
          gap: 15px;
        }
      `}</style>
    </div>
  );
}

function NFSeCard({ nfse, onConfirm, onReject, confirmando, rejeitando }) {
  const [mostrarMotivo, setMostrarMotivo] = useState(false);
  const [motivo, setMotivo] = useState('');

  const handleRejeitar = () => {
    onReject(motivo);
    setMostrarMotivo(false);
    setMotivo('');
  };

  const dataFormatada = new Date(nfse.competencia).toLocaleDateString('pt-BR');
  const valorFormatado = nfse.valor?.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <div className="nfse-card">
      <div className="card-header">
        <div className="info-principal">
          <h4>{nfse.tomador}</h4>
          <p className="numero">
            {nfse.numero && `NFS-e ${nfse.numero}`}
            {nfse.numero && nfse.chave && ' • '}
            {nfse.chave && `Chave: ${nfse.chave.substring(0, 20)}...`}
          </p>
        </div>
        <div className="valor-data">
          <div className="valor">{valorFormatado}</div>
          <div className="data">{dataFormatada}</div>
        </div>
      </div>

      {nfse.descricao_servico && (
        <div className="descricao">{nfse.descricao_servico}</div>
      )}

      <div className="card-actions">
        <button
          onClick={onConfirm}
          disabled={confirmando || rejeitando}
          className="btn-confirmar"
        >
          {confirmando ? '⏳' : '✓'} Confirmar
        </button>

        {!mostrarMotivo ? (
          <button
            onClick={() => setMostrarMotivo(true)}
            disabled={confirmando || rejeitando}
            className="btn-rejeitar"
          >
            ✗ Rejeitar
          </button>
        ) : (
          <div className="rejeicao-form">
            <input
              type="text"
              placeholder="Motivo da rejeição (opcional)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={100}
            />
            <button
              onClick={handleRejeitar}
              disabled={rejeitando}
              className="btn-confirmar-rejeicao"
            >
              {rejeitando ? '⏳' : '✓'} Confirmar rejeição
            </button>
            <button
              onClick={() => setMostrarMotivo(false)}
              className="btn-cancelar-rejeicao"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .nfse-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          background: white;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .info-principal h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
          color: #333;
        }

        .numero {
          margin: 0;
          font-size: 12px;
          color: #999;
        }

        .valor-data {
          text-align: right;
        }

        .valor {
          font-size: 18px;
          font-weight: 600;
          color: #2e7d32;
        }

        .data {
          font-size: 12px;
          color: #999;
        }

        .descricao {
          font-size: 13px;
          color: #666;
          margin-bottom: 12px;
          padding: 8px;
          background: #f5f5f5;
          border-radius: 4px;
          border-left: 3px solid #1976d2;
        }

        .card-actions {
          display: flex;
          gap: 10px;
        }

        button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-confirmar {
          background: #4caf50;
          color: white;
        }

        .btn-confirmar:hover:not(:disabled) {
          background: #388e3c;
        }

        .btn-rejeitar {
          background: #f44336;
          color: white;
        }

        .btn-rejeitar:hover:not(:disabled) {
          background: #d32f2f;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .rejeicao-form {
          display: flex;
          gap: 8px;
          flex: 1;
        }

        input {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
        }

        input:focus {
          outline: none;
          border-color: #f44336;
        }

        .btn-confirmar-rejeicao {
          background: #f44336;
          color: white;
          padding: 6px 12px;
        }

        .btn-cancelar-rejeicao {
          background: #eee;
          color: #666;
          padding: 6px 12px;
        }
      `}</style>
    </div>
  );
}
