import { useState,useEffect } from 'react';

import {
  Box,
  Button,
  Layer,
  Paragraph,
  Heading,
  Text,
  Anchor,
  RadioButtonGroup,
  Image,
  Spinner
} from 'grommet';

import Countdown from "react-countdown";

import { fromString } from 'uint8arrays'

import styled from "styled-components";
import { ethers } from "ethers";

import { useAppContext } from '../hooks/useAppState';
import  useOrbis  from '../hooks/useOrbis';

import GoldListModal from './GoldListModal';
import Stablecoins from './Stablecoins';


const StyledText = styled(Text)`
  font-weight: 600;
  line-height: 1.6;
  font: normal normal bold Poppins;

`;


export default function BuySection(props) {

  const { state } = useAppContext();
  const { orbisClient,connectSeed,addWallet,isUnderVerification } = useOrbis();

  const [busd, setBusd] = useState();
  const [value, setValue] = useState("Native");
  const [show,setShow] = useState();
  const [underVerification,setUnderVerification] = useState()

  const buyTokens = async (total) => {
    const signer = state.provider.getSigner();
    const goldListWithSigner = state.goldList.connect(signer);
    const amount = ethers.utils.parseEther(total).toString()
    let tx;
    if (value === "Native") {
      tx = await goldListWithSigner.claimTokensWithNative({
        value: amount
      });
    } else {
      const allowance = await busd.allowance(state.coinbase, state.goldList.address);
      if (amount > allowance) {
        const busdWithSigner = busd.connect(signer);
        const txApproval = await busdWithSigner.approve(state.goldList.address, amount);
        await txApproval.wait();
      }
      const goldListWithSigner = state.goldList.connect(signer);
      tx = await goldListWithSigner.claimTokensWithStable(busd.address, amount);
    }

    await tx.wait();

  }


  const getExpectedSrg = async (total) => {
    const amount = await state.goldList.getAmountOfTokens(ethers.utils.parseEther(total).toString());
    return (amount.toString() / 10 ** 18);
  }

  useEffect(() => {
    const seed = new Uint8Array(fromString(process.env.REACT_APP_DID_SEED_NOKYC, 'base16'))
    connectSeed(seed);
  },[])

  useEffect(() => {
    if(!underVerification && orbisClient){
      isUnderVerification(state.coinbase).then(newUnderVerification => {
        setUnderVerification(newUnderVerification)
      })
    }
  },[
    underVerification,
    state.coinbase,
    orbisClient
  ])



  return (
    <Box margin={{horizontal: "30%"}} height="small">
    {
      !state.coinbase &&
        <Button primary color="#ffcc00" size="large" label="Connect" onClick={state.loadWeb3Modal} className="btn-primary" />
    }
    {
      state.coinbase &&
      <>
      {
        !state.whitelisted ?
        (
          !underVerification ?
          <Box>
            <Button primary color="#ffcc00" size="large" className="btn-primary" onClick={async () => {
              await addWallet(state.coinbase,true);
              isUnderVerification(state.coinbase).then(newUnderVerification => {
                setUnderVerification(newUnderVerification)
              })
            }} label="WhiteList Me" />
          </Box> :
          <Box pad={{top:"small"}} align="center">
            <Spinner size="medium" color="white"/>
            <Text size="medium" color="white">Being whitelisted</Text>
            <Text size="xsmall" color="white">It can take up to 2 minutes</Text>
          </Box>
        ):
        show ?
        <Layer
          onEsc={() => {
            setShow(false);
          }}
          onClickOutside={() => {
            setShow(false);
          }}
        >
          <Box align="center" pad="medium">
            <Text>Payment method</Text>
            <RadioButtonGroup
              name="payment"
              options={['Native', 'Stablecoin']}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Box>
          {
            state.stablecoins &&
            value === "Stablecoin" &&
            <Stablecoins
              provider={state.provider}
              setBusd={setBusd}
              busd={busd}
            />
          }
          {
            (
              value === "Native" ||
              (
                value === "Stablecoin" && busd
              )
            ) &&
            <GoldListModal
              value={value}
              busd={busd}
              buyTokens={buyTokens}
              getExpectedSrg={getExpectedSrg}
            />
          }
        </Layer> :
        Number(state.goldListBalance) > 0 ?
        <Button primary size="large" color="#ffcc00" className="btn-primary" onClick={() => setShow(true)} label="Buy" /> :
        <Text size="medium" color="white">Sale ended</Text>
      }
      </>
    }

    </Box>
  )
}