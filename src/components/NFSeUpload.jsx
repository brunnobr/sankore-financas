import React, { useState } from 'react';
import { parseNFSeXML, validarNFSe, gerarHashDedup } from '../lib/nfse-parser';
import { supabase } from '../data/supabaseClient';
import { useAuth } from '../data/AuthContext';

export function NFSeUpload() {
  const auth = useAuth();
  const user = auth?.session?.user;
  const [step, setStep] = useState('upload'); // upload | preview | saving | done
  const [file, setFile] = useState(null);
  const [nfse, setNfse] = useState(null);
  const [validacao, setValidacao] = useState(null);
  const [erroUpload, setErroUpload] = useState(null);
  const [mensagem, setMensagem] = useState('');

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErroUpload(null);

    try {
      const texto = await selectedFile.text();
      const dadosNFSe = parseNFSeXML(texto);
      setNfse(dadosNFSe);

      const val = validarNFSe(dadosNFSe);
      setValidacao(val);

      if (val.valida) {
        setStep('preview');
      }
    } catch (err) {
      setErroUpload(err.message);
      setNfse(null);
    }
  };

  const handleEditField = (field, value) => {
    const updated = { ...nfse, [field]: value };
    setNfse(updated);

    // Re-validar
    const val = validarNFSe(updated);
    setValidacao(val);
  };

  const handleSave = async () => {
    if (!nfse || !user || !validacao?.valida) return;

    setStep('saving');
    setMensagem('Salvando NFS-e...');

    try {
      // Gerar hash de dedup
      const hash = gerarHashDedup(nfse);

      // Verificar se já existe
      const { data: existente } = await supabase
        .from('nfse')
        .select('id')
        .eq('user_id', user.id)
        .eq('hash_dedup', hash)
        .single();

      if (existente) {
        setErroUpload('Esta NFS-e já foi importada anteriormente');
        setStep('preview');
        return;
      }

      // Inserir na fila de revisão
      const { error } = await supabase
        .from('nfse')
        .insert({
          user_id: user.id,
          numero: nfse.numero,
          chave: nfse.chave,
          competencia: nfse.competencia,
          valor: nfse.valor,
          tomador: nfse.tomador,
          descricao_servico: nfse.descricaoServico,
          status: 'pendente_revisao',
          hash_dedup: hash,
          raw_xml: nfse.raw,
        });

      if (error) throw error;

      setMensagem('NFS-e adicionada à fila de revisão!');
      setStep('done');

      // Reset após 3s
      setTimeout(() => {
        setStep('upload');
        setFile(null);
        setNfse(null);
        setValidacao(null);
        setErroUpload(null);
        setMensagem('');
      }, 3000);
    } catch (err) {
      setErroUpload(`Erro ao salvar: ${err.message}`);
      setStep('preview');
    }
  };

  return (
    <div className="nfse-upload">
      {step === 'upload' && (
        <div className="upload-box">
          <h3>Importar NFS-e (XML)</h3>
          <div className="file-input-wrapper">
            <input
              type="file"
              accept=".xml"
              onChange={handleFileSelect}
              id="nfse-file"
            />
            <label htmlFor="nfse-file" className="file-input-label">
              📄 Selecione um arquivo XML
            </label>
          </div>
          {file && <p className="file-name">✓ {file.name}</p>}
          {erroUpload && <div className="erro">{erroUpload}</div>}
        </div>
      )}

      {step === 'preview' && nfse && (
        <div className="preview-box">
          <h3>Revisar dados extraídos</h3>

          {validacao && !validacao.valida && (
            <div className="erro">
              <strong>Problemas encontrados:</strong>
              <ul>
                {validacao.erros.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-fields">
            <div className="field">
              <label>Número da NFS-e</label>
              <input
                type="text"
                value={nfse.numero || ''}
                onChange={(e) => handleEditField('numero', e.target.value)}
                placeholder="(opcional)"
              />
            </div>

            <div className="field">
              <label>Chave de acesso</label>
              <input
                type="text"
                value={nfse.chave || ''}
                onChange={(e) => handleEditField('chave', e.target.value)}
                placeholder="(opcional)"
              />
            </div>

            <div className="field">
              <label>Data de competência *</label>
              <input
                type="date"
                value={nfse.competencia || ''}
                onChange={(e) => handleEditField('competencia', e.target.value)}
              />
            </div>

            <div className="field">
              <label>Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                value={nfse.valor || ''}
                onChange={(e) => handleEditField('valor', parseFloat(e.target.value) || null)}
              />
            </div>

            <div className="field">
              <label>Tomador/Cliente *</label>
              <input
                type="text"
                value={nfse.tomador || ''}
                onChange={(e) => handleEditField('tomador', e.target.value)}
              />
            </div>

            <div className="field">
              <label>Descrição do serviço</label>
              <textarea
                value={nfse.descricaoServico || ''}
                onChange={(e) => handleEditField('descricaoServico', e.target.value)}
                placeholder="(opcional)"
                rows={3}
              />
            </div>
          </div>

          <div className="actions">
            <button
              onClick={() => setStep('upload')}
              className="btn-secondary"
            >
              ← Voltar
            </button>
            <button
              onClick={handleSave}
              disabled={!validacao?.valida}
              className="btn-primary"
            >
              Adicionar à fila de revisão
            </button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div className="saving-box">
          <p>⏳ {mensagem}</p>
        </div>
      )}

      {step === 'done' && (
        <div className="success-box">
          <p>✓ {mensagem}</p>
        </div>
      )}

      <style jsx>{`
        .nfse-upload {
          padding: 20px;
          max-width: 500px;
          margin: 0 auto;
        }

        .upload-box,
        .preview-box,
        .saving-box,
        .success-box {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          background: #fafafa;
        }

        .success-box {
          background: #e8f5e9;
          border-color: #4caf50;
        }

        h3 {
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 18px;
        }

        .file-input-wrapper {
          margin-bottom: 15px;
        }

        #nfse-file {
          display: none;
        }

        .file-input-label {
          display: block;
          padding: 15px 20px;
          border: 2px dashed #999;
          border-radius: 6px;
          text-align: center;
          cursor: pointer;
          background: white;
          transition: all 0.2s;
        }

        .file-input-label:hover {
          border-color: #666;
          background: #f5f5f5;
        }

        .file-name {
          color: #4caf50;
          font-size: 14px;
          margin-top: 10px;
        }

        .erro {
          background: #ffebee;
          border: 1px solid #f44336;
          border-radius: 4px;
          padding: 12px;
          color: #c62828;
          margin-bottom: 15px;
          font-size: 14px;
        }

        .erro ul {
          margin: 8px 0 0 20px;
          padding: 0;
        }

        .erro li {
          margin: 4px 0;
        }

        .form-fields {
          margin-bottom: 20px;
        }

        .field {
          margin-bottom: 15px;
        }

        label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 5px;
          color: #333;
        }

        input[type='text'],
        input[type='number'],
        input[type='date'],
        textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
          box-sizing: border-box;
        }

        input[type='text']:focus,
        input[type='number']:focus,
        input[type='date']:focus,
        textarea:focus {
          outline: none;
          border-color: #1976d2;
          background: #f5f5f5;
        }

        textarea {
          resize: vertical;
        }

        .actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        .btn-primary,
        .btn-secondary {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #1976d2;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1565c0;
        }

        .btn-primary:disabled {
          background: #bdbdbd;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          color: #666;
          border: 1px solid #ddd;
        }

        .btn-secondary:hover {
          background: #f5f5f5;
        }

        .saving-box {
          text-align: center;
          color: #1976d2;
        }

        .success-box {
          text-align: center;
          color: #2e7d32;
        }
      `}</style>
    </div>
  );
}
